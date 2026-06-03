"use client";

import { useRef, useState, useEffect, useMemo, useCallback, memo, Suspense, lazy } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { RoundedBox, ContactShadows, Text3D, Bvh } from "@react-three/drei";
import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import type { Howl } from "howler";
import { SKILLS, KEYBOARD_ROWS, type Skill } from "./skills-data";

// ─── Absolute preload ────────────────────────────────────────────────────────
// Warm every asset that could otherwise suspend the <Canvas> on first
// interaction (font glyphs for KeyboardGuide, icon textures for every key).
// Done at module evaluation time — long before the scene mounts — so the
// useLoader / canvas-texture caches are already populated when R3F renders.
const GUIDE_FONT = "/fonts/display.typeface.json";

if (typeof window !== "undefined") {
  // 1) Preload the Text3D typeface into R3F's useLoader cache. When Text3D
  //    later calls useLoader(FontLoader, GUIDE_FONT) it resolves synchronously
  //    — no Suspense boundary trip, no flash.
  useLoader.preload(FontLoader as unknown as new () => THREE.Loader, GUIDE_FONT);

  // 2) Eager-decode every keycap icon SVG so the CanvasTexture is ready
  //    before the first keycap is hovered or clicked.
  for (const skill of SKILLS) {
    if (skill.iconPath) {
      // Side-effect: populates ICON_TEX_CACHE (see loadIconTexture below) on
      // first call after the module's helpers are defined. We can't call it
      // here (defined later in this file) — instead we kick off an Image()
      // decode so the browser cache + decode pipeline is warm by then.
      const img = new Image();
      img.decoding = "async";
      img.src = skill.iconPath;
    }
  }
}

const IS_MOBILE_VIEWPORT =
  typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

// ─── Key sounds (Howler.js) ──────────────────────────────────────────────────
// Phase 2 — Howler is dynamically imported on first user interaction.
// This removes the howler chunk (~30 KB gz) from the initial keyboard load
// and avoids an AudioContext being created before any gesture happens.
const VOL_MIN = 0.55;
const VOL_MAX = 0.8;
const RATE_MIN = 0.98;
const RATE_MAX = 1.06;

let PRESS_SOUND: Howl | null = null;
let RELEASE_SOUND: Howl | null = null;
let howlerLoading: Promise<void> | null = null;

function ensureHowler(): Promise<void> {
  if (PRESS_SOUND && RELEASE_SOUND) return Promise.resolve();
  if (howlerLoading) return howlerLoading;
  howlerLoading = import("howler").then(({ Howl }) => {
    PRESS_SOUND = new Howl({
      src: ["/sounds/key-press.mp3"],
      preload: true,
      volume: VOL_MAX,
      html5: false,
      pool: 32,
      onloaderror: () => {},
      onplayerror: () => {},
    });
    RELEASE_SOUND = new Howl({
      src: ["/sounds/key-release.mp3"],
      preload: true,
      volume: VOL_MAX,
      html5: false,
      pool: 32,
      onloaderror: () => {},
      onplayerror: () => {},
    });
  });
  return howlerLoading;
}

function playSample(sound: Howl | null) {
  if (!sound || sound.state() !== "loaded") return;
  const volume = VOL_MIN + Math.random() * (VOL_MAX - VOL_MIN);
  const rate = RATE_MIN + Math.random() * (RATE_MAX - RATE_MIN);
  try {
    const id = sound.play();
    sound.volume(volume, id);
    sound.rate(rate, id);
  } catch {
    // Mobile autoplay restrictions: first user gesture unlocks the AudioContext.
  }
}

function playKeyPress() {
  if (PRESS_SOUND) return playSample(PRESS_SOUND);
  ensureHowler().then(() => playSample(PRESS_SOUND));
}

function playKeyRelease() {
  if (RELEASE_SOUND) return playSample(RELEASE_SOUND);
  ensureHowler().then(() => playSample(RELEASE_SOUND));
}

// ─── Key dimensions ───────────────────────────────────────────────────────────
// Keys sit in the XY plane. Group rotation tilts them toward the viewer.
// Hover moves keys in Z+ (toward camera) — physically correct for a tilted surface.
// Square keycaps in a tight uniform grid (like the reference)
const KEY_W        = 0.72;
const KEY_H        = 0.72;
const KEY_DEPTH    = 0.38;   // flatter keycap profile (premium mech look)
const KEY_GAP      = 0.07;
const ROW_GAP      = 0.07;
const KEY_RADIUS   = 0.11;
// Negative Z = press DOWN into the base (real keypress), since keys live in XY
// plane with Z+ pointing out of the keycap face. Small, realistic travel.
const HOVER_PRESS  = -0.22;

// Overall keyboard scale. With 4 rows (24 keys) the keyboard is taller,
// so we shrink slightly to keep it fully framed inside the canvas.
const KEYBOARD_SCALE = 0.66;

// Thick warm-brown chassis like the reference render
const BASE_INSET   = 0.36;
const BASE_Z       = -(KEY_DEPTH / 2 + 0.42);
const BASE_THICK   = 0.85;
const BASE_RADIUS  = 0.22;

// ─── Shared materials ─────────────────────────────────────────────────────────
// Default base material values (calibration-friendly).
export type BaseCfg = {
  color: string;
  roughness: number;
  metalness: number;
  clearcoat: number;
  envMapIntensity: number;
};
const DEFAULT_BASE: BaseCfg = {
  color: "#FFFFFF",
  roughness: 0.62,
  metalness: 0.27,
  clearcoat: 0.65,
  envMapIntensity: 1.38,
};

const TRAY_MATERIAL = new THREE.MeshStandardMaterial({
  color:     new THREE.Color("#141414"),
  roughness: 0.50,
  metalness: 0.18,
});

// ─── Icon texture loader ─────────────────────────────────────────────────────
// Loads an SVG from /public/icons/* into an offscreen canvas and returns a
// CanvasTexture suitable for use as a `map` on a small Plane parented to the
// keycap. Cached per (path|color) so each unique icon rasterises exactly once.
const ICON_TEX_CACHE = new Map<string, THREE.Texture>();
const ICON_PX = 512;

// Auto-detect icon "thinness" by measuring opaque-pixel coverage inside the
// icon's tight bounding box. Solid/filled glyphs cover a large fraction of
// their bbox; line-art / wireframe / detailed logos cover very little.
// Returns: 0 = solid (no boost), higher = thinner (more boost needed).
function measureThinness(img: HTMLImageElement): number {
  const S = 64; // small probe canvas — fast, enough to estimate coverage
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const cx = c.getContext("2d");
  if (!cx) return 0;
  const iw = img.width || 24;
  const ih = img.height || 24;
  const s = Math.min(S / iw, S / ih);
  const dw = iw * s, dh = ih * s;
  cx.drawImage(img, (S - dw) / 2, (S - dh) / 2, dw, dh);
  const data = cx.getImageData(0, 0, S, S).data;
  let opaque = 0, minX = S, minY = S, maxX = 0, maxY = 0;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (data[(y * S + x) * 4 + 3] > 24) {
        opaque++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (opaque === 0) return 0;
  const bboxArea = Math.max(1, (maxX - minX + 1) * (maxY - minY + 1));
  const coverage = opaque / bboxArea; // 0..1
  // Coverage thresholds tuned empirically:
  //  >0.55 → solid glyph (React, Tailwind, Figma blob)  → no boost
  //  0.35..0.55 → mid                                    → mild boost
  //  0.18..0.35 → thin                                   → strong boost
  //  <0.18 → very thin (MySQL dolphin outline, Java)     → max boost
  if (coverage >= 0.55) return 0;
  if (coverage >= 0.35) return 1;
  if (coverage >= 0.18) return 2;
  return 3;
}

function loadIconTexture(path: string, tint?: string): THREE.Texture {
  const key = `${path}|${tint ?? ""}`;
  const cached = ICON_TEX_CACHE.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = ICON_PX;
  canvas.height = ICON_PX;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.needsUpdate = true;
  ICON_TEX_CACHE.set(key, tex);

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Auto-classify thinness, then derive bold (dilation radius in px) and
    // an optional size boost. Solid icons receive zero boost → natural look.
    const thinness = measureThinness(img);
    const bold = thinness; // 0,1,2,3 px dilation radius
    const extraScale = thinness >= 3 ? 1.08 : thinness >= 2 ? 1.04 : 1;

    ctx.clearRect(0, 0, ICON_PX, ICON_PX);
    // Fit-contain with padding so the icon never touches keycap edges.
    const pad = ICON_PX * 0.10;
    const box = (ICON_PX - pad * 2) * extraScale;
    const iw = img.width || 24;
    const ih = img.height || 24;
    const scale = Math.min(box / iw, box / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (ICON_PX - dw) / 2;
    const dy = (ICON_PX - dh) / 2;

    // Dilation: draw the icon multiple times with sub-pixel offsets to thicken
    // strokes. This emulates a stroke-width boost without editing each SVG.
    if (bold >= 1) {
      for (let r = 1; r <= bold; r++) {
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          ctx.drawImage(img, dx + Math.cos(ang) * r, dy + Math.sin(ang) * r, dw, dh);
        }
      }
    }
    ctx.drawImage(img, dx, dy, dw, dh);

    // Force all icons to render pure white while preserving alpha shape.
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = tint ?? "#ffffff";
    ctx.fillRect(0, 0, ICON_PX, ICON_PX);
    ctx.globalCompositeOperation = "source-over";

    // Subtle dark outline behind the white shape for contrast against
    // light/saturated keycaps. Drawn UNDER via destination-over.
    ctx.globalCompositeOperation = "destination-over";
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    // Re-stamp the alpha so the shadow has a source to cast from.
    ctx.drawImage(canvas, 0, 0);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.globalCompositeOperation = "source-over";

    tex.needsUpdate = true;
  };
  img.onerror = () => { /* leave transparent — keycap renders cleanly */ };
  img.src = path;
  return tex;
}

// ─── Icon plane parented to the keycap lift group ────────────────────────────
// Uses the same KEY_DEPTH/topTiltDeg as buildKeycapGeometry so the icon sits
// flush on the dished top surface. Sized as a fraction of the key width so it
// looks consistent across square and (future) wide keys.
function KeycapIcon({ iconPath, width }: { iconPath?: string; width: number }) {
  const texture = useMemo(
    () => (iconPath ? loadIconTexture(iconPath) : null),
    [iconPath]
  );
  useEffect(() => () => { /* cached globally — do not dispose */ }, []);

  if (!texture) return null;

  // Icon size: ~58% of key width — large, legible, never overflows.
  const size = width * 0.58;
  // Sit just above the top face (keycap top centre is at z = +KEY_DEPTH/2).
  // Small +z offset prevents z-fighting against the dished cap.
  const z = KEY_DEPTH / 2 + 0.006;
  // Match the keycap top-plane back-tilt (7°). Top surface tilts about X axis
  // (front lower, back higher), so rotate the plane the same way.
  const tiltRad = THREE.MathUtils.degToRad(7);

  return (
    <mesh
      position={[0, 0.025, z]}
      rotation={[tiltRad, 0, 0]}
      raycast={() => null}
    >
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

// ─── Procedural keycap geometry (KeyV2-inspired) ─────────────────────────────
// Lofted hull between a wider lower rounded rectangle and a smaller molded top.
// The top surface is a uniform row/column grid clipped to a rounded rectangle:
// no triangle fan, no centre convergence, no star topology, no pyramid shading.
function buildKeycapGeometry(
  w: number,
  h: number,
  depth: number,
  opts: {
    topScaleX?: number;   // top width  / base width
    topScaleY?: number;   // top depth  / base depth
    radiusBot?: number;
    radiusTop?: number;
    tiltY?: number;       // back-tilt: top shifted +Y
    dish?: number;        // concavity depth at top center
    segPerCorner?: number;
    topGrid?: number;     // subdivisions across top face (grid resolution)
    topTiltDeg?: number;  // physical top plane: front lower, back higher
  } = {}
): THREE.BufferGeometry {
  const topScaleX   = opts.topScaleX   ?? 0.80;
  const topScaleY   = opts.topScaleY   ?? 0.80;
  const radiusBot   = opts.radiusBot   ?? 0.11;
  const radiusTop   = opts.radiusTop   ?? 0.09;
  const tiltY       = opts.tiltY       ?? 0.025;
  const topDishDepth = opts.dish       ?? 0.01;
  const segPerCorner = opts.segPerCorner ?? 10;
  const topGrid     = opts.topGrid     ?? 28;
  const topTiltDeg  = opts.topTiltDeg  ?? 7;

  const smoothstep = (edge0: number, edge1: number, x: number) => {
    const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  };

  const roundedRect = (rw: number, rh: number, r: number) => {
    const hw = rw / 2 - r;
    const hh = rh / 2 - r;
    const corners: [number, number, number][] = [
      [+hw, -hh, -Math.PI / 2],
      [+hw, +hh, 0],
      [-hw, +hh, Math.PI / 2],
      [-hw, -hh, Math.PI],
    ];
    const pts: [number, number][] = [];
    for (const [cx, cy, a0] of corners) {
      for (let i = 0; i < segPerCorner; i++) {
        const a = a0 + (i / segPerCorner) * (Math.PI / 2);
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
    }
    return pts;
  };

  const N = 4 * segPerCorner;

  const zBot = -depth / 2;
  const zTop =  depth / 2;

  const positions: number[] = [];
  const indices: number[] = [];

  const tw = (w * topScaleX) / 2;
  const th = (h * topScaleY) / 2;
  const rT = radiusTop;
  const topRise = Math.tan(THREE.MathUtils.degToRad(topTiltDeg)) * (h * topScaleY);
  const topSlopeZ = (localY: number) => (localY / (h * topScaleY)) * topRise;
  const topDishZ = (localX: number, localY: number) => {
    const nx = localX / tw;
    const ny = localY / th;
    const q = Math.min(1, nx * nx + ny * ny);
    // Broad, flat-bottomed micro dish: no single centre point is pulled.
    return -topDishDepth * (1 - smoothstep(0.18, 1, q));
  };
  const topSurfaceZ = (localX: number, localY: number) =>
    zTop + topSlopeZ(localY) + topDishZ(localX, localY);

  // ─── Molded side hull: multiple rings for rounded, non-low-poly side flow ──
  const layerTs = [0, 0.16, 0.46, 0.74, 1];
  const sideRingStarts: number[] = [];
  for (const t of layerTs) {
    const inset = smoothstep(0, 1, t);
    const rw = THREE.MathUtils.lerp(w, w * topScaleX, inset);
    const rh = THREE.MathUtils.lerp(h, h * topScaleY, inset);
    const rr = THREE.MathUtils.lerp(radiusBot, radiusTop, inset);
    const yShift = tiltY * inset;
    const zBase = THREE.MathUtils.lerp(zBot, zTop, t);
    const slopeWeight = smoothstep(0.5, 1, t);
    const ring = roundedRect(rw, rh, rr);
    sideRingStarts.push(positions.length / 3);
    for (const [x, y] of ring) {
      positions.push(x, y + yShift, zBase + topSlopeZ(y) * slopeWeight);
    }
  }
  for (let l = 0; l < sideRingStarts.length - 1; l++) {
    const a0 = sideRingStarts[l];
    const b0 = sideRingStarts[l + 1];
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      indices.push(a0 + i, a0 + j, b0 + j);
      indices.push(a0 + i, b0 + j, b0 + i);
    }
  }

  // ─── Top cap: concentric rounded-rect rings, perimeter SHARED with last
  // side ring (no seam, no duplicated vertices, no clipped-grid mismatch).
  // Avoids the central triangle fan visual by ending with a tiny inner ring
  // (~6% scale) before the single centre vertex, so the fan area is sub-pixel.
  const topRings = 7;
  const innerScale = 0.06;
  const lastSideStart = sideRingStarts[sideRingStarts.length - 1];
  const topRingStarts: number[] = [lastSideStart];

  for (let r = 1; r <= topRings; r++) {
    const t = r / (topRings + 1);
    const k = smoothstep(0, 1, t);
    const scale = THREE.MathUtils.lerp(1, innerScale, k);
    const rw = w * topScaleX * scale;
    const rh = h * topScaleY * scale;
    const rr = THREE.MathUtils.lerp(radiusTop, radiusTop * 0.4, k);
    const ring = roundedRect(rw, rh, rr);
    topRingStarts.push(positions.length / 3);
    for (const [x, y] of ring) {
      positions.push(x, y + tiltY, topSurfaceZ(x, y));
    }
  }

  for (let l = 0; l < topRingStarts.length - 1; l++) {
    const a0 = topRingStarts[l];
    const b0 = topRingStarts[l + 1];
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      indices.push(a0 + i, a0 + j, b0 + j);
      indices.push(a0 + i, b0 + j, b0 + i);
    }
  }

  // Tiny centre fan — innermost ring is so small the fan is visually flat.
  const centreIdx = positions.length / 3;
  positions.push(0, tiltY, topSurfaceZ(0, 0));
  const innerStart = topRingStarts[topRingStarts.length - 1];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    indices.push(innerStart + i, innerStart + j, centreIdx);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  // Suppress unused-var warning for legacy `topGrid` opt.
  void topGrid;
  return geo;
}

// ─── Individual Keycap ────────────────────────────────────────────────────────
function Keycap({
  skill, position, width = KEY_W, onHover, isHovered,
}: {
  skill: Skill;
  position: [number, number, number];
  width?: number;
  onHover: (skill: Skill | null) => void;
  isHovered: boolean;
}) {
  const liftRef  = useRef<THREE.Group>(null);   // ← wraps mesh+icon, animates together
  const meshRef  = useRef<THREE.Mesh>(null);
  const matRef   = useRef<THREE.MeshPhysicalMaterial>(null);
  const currentZ = useRef(0);                  // Z offset from rest (0 = resting)

  const baseColor = new THREE.Color(skill.color);
  const glowColor = baseColor.clone().multiplyScalar(1.8);

  // Procedural geometry — memoized per key dimensions.
  const geometry = useMemo(
    () =>
      buildKeycapGeometry(width, KEY_H, KEY_DEPTH, {
        topScaleX: 0.80,
        topScaleY: 0.80,
        radiusBot: KEY_RADIUS,
        radiusTop: KEY_RADIUS * 0.85,
        tiltY: 0.025,
        dish: 0.012,        // topDishDepth: micro dish, flat-centre, no peak
        segPerCorner: 10,
        topGrid: 28,
        topTiltDeg: 7,
      }),
    [width]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    if (!liftRef.current || !matRef.current) return;

    // Both mesh AND icon are children of liftRef → they lift together.
    const destZ = isHovered ? HOVER_PRESS : 0;
    currentZ.current += (destZ - currentZ.current) * Math.min(delta * 14, 1);
    liftRef.current.position.z = currentZ.current;

    // Emissive glow lerp
    const targetEI = isHovered ? 0.28 : 0;
    matRef.current.emissiveIntensity +=
      (targetEI - matRef.current.emissiveIntensity) * Math.min(delta * 10, 1);
    matRef.current.emissive.lerp(glowColor, isHovered ? 0.12 : 0.04);
  });

  return (
    <group
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        // Direct DOM mutation — bypass React state to avoid main-thread
        // re-render at the exact instant the 3D hover animation starts.
        if (typeof document !== "undefined") {
          document.body.style.cursor = "pointer";
        }
        onHover(skill);
        const native = e.nativeEvent as PointerEvent | MouseEvent;
        const pointerType = (native as PointerEvent)?.pointerType;
        const buttons = (native as PointerEvent)?.buttons;
        if (pointerType !== "mouse") return;
        if (typeof buttons === "number" && buttons !== 0) return;
        playKeyPress();
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        if (typeof document !== "undefined") {
          document.body.style.cursor = "auto";
        }
        onHover(null);
        const native = e.nativeEvent as PointerEvent | MouseEvent;
        const pointerType = (native as PointerEvent)?.pointerType;
        if (pointerType !== "mouse") return;
        playKeyRelease();
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        const native = e.nativeEvent as PointerEvent | MouseEvent;
        const pointerType = (native as PointerEvent)?.pointerType;
        const button = (native as MouseEvent)?.button;
        const isPrimary = (native as PointerEvent)?.isPrimary;
        if (pointerType === "mouse" || pointerType === "" || pointerType === undefined) return;
        if (pointerType !== "touch" && pointerType !== "pen") return;
        if (typeof button === "number" && button !== 0) return;
        if (isPrimary === false) return;
        playKeyPress();
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        const native = e.nativeEvent as PointerEvent | MouseEvent;
        const pointerType = (native as PointerEvent)?.pointerType;
        if (pointerType !== "touch" && pointerType !== "pen") return;
        playKeyRelease();
      }}
      onPointerCancel={(e) => {
        e.stopPropagation();
        const native = e.nativeEvent as PointerEvent | MouseEvent;
        const pointerType = (native as PointerEvent)?.pointerType;
        if (pointerType !== "touch" && pointerType !== "pen") return;
        playKeyRelease();
      }}
    >
      {/* liftRef group animates in Z — mesh AND icon travel together on hover */}
      <group ref={liftRef}>
        {/* Procedural keycap — single mesh, hull from bottom→top rounded rect */}
        <mesh
          ref={meshRef}
          geometry={geometry}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial
            ref={matRef}
            color={baseColor}
            roughness={0.42}
            metalness={0.04}
            clearcoat={0.35}
            clearcoatRoughness={0.25}
            reflectivity={0.5}
            emissive={glowColor}
            emissiveIntensity={0}
          />
        </mesh>

        {/* Icon — CanvasTexture rasterised SVG painted on a small plane parented
            to the same lift group, so it travels with the keycap on hover/click.
            Sits a hair above the top face to avoid z-fighting; tilted to match
            the keycap top plane (topTiltDeg = 7°). */}
        <KeycapIcon iconPath={skill.iconPath} width={width} />
      </group>
    </group>
  );
}

// ─── Keyboard Base Plate ──────────────────────────────────────────────────────
function KeyboardBase({ kbdWidth, kbdHeight, baseCfg }: { kbdWidth: number; kbdHeight: number; baseCfg: BaseCfg }) {
  const w = kbdWidth  + BASE_INSET * 2;
  const h = kbdHeight + BASE_INSET * 2;

  // Inner recessed tray (black cavity) — sits inside the white base,
  // proportional to the keys grid with a small margin. Top surface lies just
  // below the keycap bottoms so keys appear seated into the cavity.
  const trayW = kbdWidth + 0.16;
  const trayH = kbdHeight + 0.16;
  // Black inset sitting just on top of the white base, creating the cavity
  // illusion. Top must be ABOVE the base top to be visible.
  const TRAY_THICK = 0.22;
  const baseTopZ   = BASE_Z + BASE_THICK / 2;
  const trayTopZ   = baseTopZ + 0.012;
  const trayCenterZ = trayTopZ - TRAY_THICK / 2;

  return (
    <>
      {/* Main body — sits behind keys in Z, physically contains them */}
      <RoundedBox
        args={[w, h, BASE_THICK]}
        radius={BASE_RADIUS}
        smoothness={6}
        position={[0, 0, BASE_Z]}
        receiveShadow
        castShadow
      >
        <meshPhysicalMaterial
          color={baseCfg.color}
          roughness={baseCfg.roughness}
          metalness={baseCfg.metalness}
          clearcoat={baseCfg.clearcoat}
          clearcoatRoughness={0.15}
          reflectivity={0.65}
          envMapIntensity={baseCfg.envMapIntensity}
        />
      </RoundedBox>

      {/* Inner black recess — gives the impression of a cavity holding the keys */}
      <RoundedBox
        args={[trayW, trayH, TRAY_THICK]}
        radius={0.06}
        smoothness={4}
        position={[0, 0, trayCenterZ]}
        receiveShadow
      >
        <meshStandardMaterial
          color="#070707"
          roughness={0.85}
          metalness={0.05}
        />
      </RoundedBox>
    </>
  );
}

// ─── Scene Lighting ───────────────────────────────────────────────────────────
function Lighting() {
  return (
    <>
      {/* Balanced ambient — keyboard faces upward now, needs slightly more fill */}
      <ambientLight intensity={0.25} />

      {/* Main key light — from above and slightly right, illuminates key surfaces */}
      <directionalLight
        position={[2, 10, 4]}
        intensity={2.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.001}
      />

      {/* Blue rim light — left accent, space aesthetic */}
      <pointLight position={[-5, 4, 3]} intensity={1.1} color="#2244dd" decay={2} />

      {/* Warm fill (right) — softens the blue shadows */}
      <pointLight position={[5, 2, 5]} intensity={0.55} color="#fff8ee" decay={2} />

      {/* Top spot — highlights keycap tops */}
      <spotLight
        position={[0, 8, 2]}
        intensity={0.7}
        angle={0.45}
        penumbra={0.6}
        color="#ffffff"
        decay={2}
      />

      {/* Under-glow green — bleeds onto base bottom edge */}
      <pointLight position={[0, -2.5, 2]} intensity={0.22} color="#00ff6e" decay={2} />
    </>
  );
}

// ─── Locked camera + keyboard transform (calibrated to reference) ────────────
export type CamCfg = {
  camX: number; camY: number; camZ: number; fov: number;
  yaw: number; pitch: number; roll: number;
};
const LOCKED_CAM: CamCfg = {
  camX: -1.3, camY: 8.7, camZ: 4.9, fov: 26.5,
  yaw: 0.308407346410207,
  pitch: -1.85,
  roll: 0.488407346410207,
};
const DESKTOP_KEYBOARD_POS: [number, number, number] = [0, 0, 0];
const MOBILE_KEYBOARD_POS: [number, number, number] = [0, 0, 0];
const FIXED_KEYBOARD_POS = IS_MOBILE_VIEWPORT ? MOBILE_KEYBOARD_POS : DESKTOP_KEYBOARD_POS;
const FIXED_KEYBOARD_ROTATION: [number, number, number] = [
  LOCKED_CAM.pitch,
  LOCKED_CAM.yaw,
  LOCKED_CAM.roll,
];
const FIXED_KEYBOARD_SCALE = KEYBOARD_SCALE;
const DESKTOP_CAMERA_FOV = LOCKED_CAM.fov;
const MOBILE_CAMERA_FOV = LOCKED_CAM.fov - 2;
const FIXED_CAMERA_FOV = IS_MOBILE_VIEWPORT ? MOBILE_CAMERA_FOV : DESKTOP_CAMERA_FOV;
const FIXED_CAMERA_ROTATION: [number, number, number] = [
  -1.05786131280124,
  -0.12946719105220045,
  -0.22533570240213355,
];

// ─── Full Keyboard Group ──────────────────────────────────────────────────────
function Keyboard({ onHover, hoveredId, cam, baseCfg }: {
  onHover: (skill: Skill | null) => void;
  hoveredId: string | null;
  cam: CamCfg;
  baseCfg: BaseCfg;
}) {
  const skillMap = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

  const maxRowW = Math.max(
    ...KEYBOARD_ROWS.map((row) =>
      row.reduce((acc, id) => {
        const s = skillMap[id];
        const span = s?.colSpan ?? 1;
        return acc + KEY_W * span + KEY_GAP * (span - 1);
      }, 0) + (row.length - 1) * KEY_GAP
    )
  );
  const totalH = KEYBOARD_ROWS.length * KEY_H + (KEYBOARD_ROWS.length - 1) * ROW_GAP;

  return (
    <group
      position={FIXED_KEYBOARD_POS}
      rotation={FIXED_KEYBOARD_ROTATION}
      scale={FIXED_KEYBOARD_SCALE}
    >
      <KeyboardBase kbdWidth={maxRowW} kbdHeight={totalH} baseCfg={baseCfg} />

      {/* Cinematic 3D guide — real extruded text inside the same scene/group as
          the keyboard, so it inherits the isometric rotation, lighting and
          shadows. No HTML overlay, no CSS pseudo-3D. Anchored just above the
          top-left corner of the key grid, sitting on the keycap top plane. */}
      {/* Suspense isolated to the guide subtree. Even if a font or texture
          ever needs to load lazily, the surrounding keyboard scene stays
          fully mounted and visible — no canvas-wide flash. */}
      <Suspense fallback={null}>
        <KeyboardGuide
          skill={hoveredId ? skillMap[hoveredId] : null}
          anchorX={-maxRowW / 2}
          anchorY={totalH / 2 + 0.72}
        />
      </Suspense>


      {KEYBOARD_ROWS.map((row, rowIdx) => {
        const rowWidth =
          row.reduce((acc, id) => {
            const s = skillMap[id];
            const span = s?.colSpan ?? 1;
            return acc + KEY_W * span + KEY_GAP * (span - 1);
          }, 0) + (row.length - 1) * KEY_GAP;

        let xCursor = -rowWidth / 2;
        const rowY =
          (KEYBOARD_ROWS.length - 1 - rowIdx) * (KEY_H + ROW_GAP) -
          totalH / 2 +
          KEY_H / 2;

        return row.map((id) => {
          const skill = skillMap[id];
          if (!skill) return null;
          const span = skill.colSpan ?? 1;
          const kw   = KEY_W * span + KEY_GAP * (span - 1);
          const kx   = xCursor + kw / 2;
          xCursor   += kw + KEY_GAP;

          return (
            <Keycap
              key={skill.id}
              skill={skill}
              position={[kx, rowY, 0]}
              width={kw}
              onHover={onHover}
              isHovered={hoveredId === skill.id}
            />
          );
        });
      })}
    </group>
  );
}

// (GUIDE_FONT is declared at the top of the file alongside the preload calls.)


// ─── 3D Guide (in-canvas, extruded text) ─────────────────────────────────────
// Lives inside the keyboard group → shares camera, rotation, lights, shadows.
// Heading + description are real Text3D meshes with shallow extrusion and a
// micro bevel — premium, integrated, never reads as WordArt or a hero heading.
function KeyboardGuide({
  skill, anchorX, anchorY,
}: {
  skill: Skill | null;
  anchorX: number;
  anchorY: number;
}) {
  if (!skill) return null;

  // Sit on the same XY plane as the keycap tops. Z+ in local space points out
  // of the keycap face, so a small +Z lifts the text just above the base
  // without making it look like a floating overlay.
  const z = KEY_DEPTH / 2 + 0.02;

  return (
    <group position={[anchorX, anchorY, z]}>
      {/* Heading — extruded glyphs, micro bevel, off-white standard material */}
      <Text3D
        font={GUIDE_FONT}
        size={0.36}
        height={0.065}
        curveSegments={6}
        bevelEnabled
        bevelSize={0.003}
        bevelThickness={0.004}
        bevelSegments={2}
        letterSpacing={-0.012}
        castShadow
      >
        {skill.label}
        <meshStandardMaterial
          color="#ffffff"
          roughness={0.55}
          metalness={0.08}
        />
      </Text3D>

      {/* Description — clean, sharp, technical label. Flat, lightweight, no hero look */}
      <group position={[0, -0.42, 0]}>
        <Text3D
          font={GUIDE_FONT}
          size={0.17}
          height={0.01}
          curveSegments={4}
          bevelEnabled={false}
          letterSpacing={-0.004}
        >
          {skill.description}
          <meshStandardMaterial
            color="#ffffff"
            roughness={0.35}
            metalness={0.03}
          />
        </Text3D>
      </group>
    </group>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
// ─── Memoized 3D scene ───────────────────────────────────────────────────────
// Owns its own hover state, so hover/click interactions stay LOCAL to this
// subtree and never bubble up to the parent. Wrapped in React.memo with a
// custom equality check so React never reconciles (and never unmounts) the
// <Canvas> once it has mounted. The 3D engine keeps full control of its
// internal render loop — no remounts, no flashes, no stale frames.
type Scene3DProps = {
  cam: CamCfg;
  baseCfg: BaseCfg;
  preserveDrawingBuffer: boolean;
  active: boolean;
  onReady: () => void;
};

const Scene3DInner = ({ cam, baseCfg, preserveDrawingBuffer, active, onReady }: Scene3DProps) => {
  // Hover state lives HERE — not in the parent — so updates from R3F's native
  // pointer events do not re-render any ancestor component.
  const [hoveredSkill, setHoveredSkill] = useState<Skill | null>(null);
  const handleHover = useCallback((skill: Skill | null) => {
    setHoveredSkill(skill);
  }, []);

  // Visual quality matches desktop on mobile. Performance is preserved by
  // pausing the render loop via `frameloop` when the canvas is off-screen.


  const handleCreated = useCallback(
    ({ gl, scene, camera, invalidate }: {
      gl: THREE.WebGLRenderer;
      scene: THREE.Scene;
      camera: THREE.Camera;
      invalidate: () => void;
    }) => {
      // ── Shader warm-up ──────────────────────────────────────────────────────
      // Compile every material/program now, before the user can interact, so
      // the first hover does NOT trigger late shader compilation (the main
      // cause of "first interaction jank" on WebGL keyboards).
      try {
        gl.compile(scene, camera);
      } catch {
        // Some drivers / contexts may throw if not fully initialised — the
        // next gl.render() call below will warm them up regardless.
      }

      // Force the first paint synchronously so the GPU uploads geometry
      // before the user can interact. Then signal the parent to fade-in.
      try {
        gl.render(scene, camera);
      } catch {
        // Defensive: some drivers throw if context isn't fully ready —
        // invalidate() will schedule the next frame regardless.
      }
      // CRITICAL: when this <Canvas> starts in frameloop="never" (off-screen
      // at mount), R3F will NOT paint until invalidate() is called. Without
      // this, the keyboard would stay blank until the section enters the
      // viewport. We call it explicitly so the first frame is committed
      // regardless of frameloop mode, and onReady can fire the fade-in.
      invalidate();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => onReady());
      });
    },
    [onReady],
  );

  return (
    <Canvas
      shadows
      frameloop={active ? "always" : "never"}
      camera={{
        position: [LOCKED_CAM.camX, LOCKED_CAM.camY, LOCKED_CAM.camZ],
        rotation: FIXED_CAMERA_ROTATION,
        fov: FIXED_CAMERA_FOV,
      }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer }}
      style={{ background: "transparent" }}
      onCreated={handleCreated}
    >

      <Lighting />

      {/* ── Hidden shader warm-up ────────────────────────────────────────────
          A material's program variant is keyed on its enabled features. The
          keycap's "hovered" state uses emissiveIntensity > 0; if no visible
          mesh has that on Frame 0, the GPU compiles that program ONLY when
          the user hovers — causing First Interaction Jank. We mount an
          invisible mesh (colorWrite=false, far behind the camera) that uses
          the exact hover variant so gl.compile() in handleCreated caches it.
          Zero pixels drawn, but the shader cache is fully populated. */}
      <mesh position={[0, -10000, 0]} frustumCulled={false}>
        <planeGeometry args={[0.01, 0.01]} />
        <meshPhysicalMaterial
          color="#ffffff"
          roughness={0.42}
          metalness={0.04}
          clearcoat={0.35}
          clearcoatRoughness={0.25}
          reflectivity={0.5}
          emissive="#ffffff"
          emissiveIntensity={0.28}
          colorWrite={false}
          depthWrite={false}
        />
      </mesh>


      {/* BVH-accelerated raycasting: hover/click hit-tests become O(log n)
          across the 24 keycap meshes, eliminating raycaster cost on the
          first interaction. */}
      <Bvh firstHitOnly>
        <Keyboard
          onHover={handleHover}
          hoveredId={hoveredSkill?.id ?? null}
          cam={cam}
          baseCfg={baseCfg}
        />
      </Bvh>

      {/* Soft contact shadow on invisible ground plane.
          frames={1} = renders once (static shadow), zero performance cost. */}
      <ContactShadows
        position={[0, -2.4, 0]}
        scale={16}
        blur={3.2}
        opacity={0.45}
        far={5}
        color="#000000"
        frames={1}
      />
    </Canvas>
  );
};

// Custom equality: only re-render the 3D scene when calibration settings
// actually change. The `onReady` callback is stable (useCallback in parent).
const Scene3D = memo(Scene3DInner, (prev, next) => {
  if (prev.preserveDrawingBuffer !== next.preserveDrawingBuffer) return false;
  if (prev.onReady !== next.onReady) return false;
  if (prev.active !== next.active) return false;
  if (
    prev.cam.camX !== next.cam.camX ||
    prev.cam.camY !== next.cam.camY ||
    prev.cam.camZ !== next.cam.camZ ||
    prev.cam.fov  !== next.cam.fov  ||
    prev.cam.yaw  !== next.cam.yaw  ||
    prev.cam.pitch !== next.cam.pitch ||
    prev.cam.roll !== next.cam.roll
  ) return false;
  if (
    prev.baseCfg.color !== next.baseCfg.color ||
    prev.baseCfg.roughness !== next.baseCfg.roughness ||
    prev.baseCfg.metalness !== next.baseCfg.metalness ||
    prev.baseCfg.clearcoat !== next.baseCfg.clearcoat ||
    prev.baseCfg.envMapIntensity !== next.baseCfg.envMapIntensity
  ) return false;
  return true;
});
Scene3D.displayName = "Scene3D";


// ─── Main export ──────────────────────────────────────────────────────────────
export default function KeyboardScene() {
  const [cam, setCam] = useState<CamCfg>(LOCKED_CAM);
  const [baseCfg, setBaseCfg] = useState<BaseCfg>(DEFAULT_BASE);
  const [calibrating, setCalibrating] = useState(false);
  // Stale-frame fix: canvas only becomes visible after R3F's `onCreated`
  // confirms the first frame is on the GPU. Driven by native engine
  // lifecycle — no timers, no synthetic events, no forced re-renders.
  // Stored in a ref-mirror so the onReady callback stays referentially stable
  // across renders (preventing the memoized Scene3D from re-mounting).
  const [isLoaded, setIsLoaded] = useState(false);
  const loadedRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("calibrate") === "1") setCalibrating(true);
  }, []);

  // Perf: pause the WebGL render loop when the section is off-screen, so it
  // doesn't compete with scroll on other sections. rootMargin=200px gives
  // the engine lead time before the user actually sees the keyboard.
  const [active, setActive] = useState(true);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Stable callback identity for the entire session — fires once.
  const handleReady = useCallback(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setIsLoaded(true);
  }, []);

  return (
    <div ref={wrapRef} className="relative left-1/2 -translate-x-[46%] sm:-translate-x-[47%] w-[120vw] sm:w-[110vw] md:left-1/2 md:-translate-x-1/2 md:w-full h-[380px] sm:h-[480px] md:h-[700px] lg:h-[760px] overflow-visible">
      <div
        className="absolute inset-0"
        style={{
          opacity: isLoaded ? 1 : 0,
          pointerEvents: isLoaded ? "auto" : "none",
          transition: "opacity 0.8s ease-in-out",
        }}
      >
        <Scene3D
          cam={cam}
          baseCfg={baseCfg}
          preserveDrawingBuffer={calibrating}
          active={active}
          onReady={handleReady}
        />
      </div>


      {calibrating && (
        <Suspense fallback={null}>
          <LazyRecalibrateButton
            cam={cam} setCam={setCam} wrapRef={wrapRef}
            baseCfg={baseCfg} setBaseCfg={setBaseCfg}
          />
        </Suspense>
      )}
    </div>
  );
}



// Lazy-load the recalibration UI — only fetched when ?calibrate=1 is present.
const LazyRecalibrateButton = lazy(() => import("./RecalibrateButton"));

