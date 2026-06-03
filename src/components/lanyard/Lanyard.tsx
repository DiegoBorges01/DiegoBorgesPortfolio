/* eslint-disable react/no-unknown-property */
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, extend, useFrame } from "@react-three/fiber";
import { useGLTF, useTexture, Environment, Lightformer } from "@react-three/drei";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
} from "@react-three/rapier";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";

import cardGLB from "@/assets/lanyard/card.glb";
import lanyard from "@/assets/lanyard/lanyard.png";
import cardFrontImg from "@/assets/lanyard/card-front.webp";
import cardBackImg from "@/assets/lanyard/card-back.webp";

import * as THREE from "three";
import "./Lanyard.css";
import { CARD_FACE_CONFIG } from "./cardFaceConfig";

extend({ MeshLineGeometry, MeshLineMaterial });

useGLTF.preload(cardGLB);
useTexture.preload(lanyard);
useTexture.preload(cardFrontImg);
useTexture.preload(cardBackImg);

function createRoundedFaceGeometry(width: number, height: number, radius: number) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const shape = new THREE.Shape();

  shape.moveTo(-halfWidth + radius, -halfHeight);
  shape.lineTo(halfWidth - radius, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + radius);
  shape.lineTo(halfWidth, halfHeight - radius);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - radius, halfHeight);
  shape.lineTo(-halfWidth + radius, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - radius);
  shape.lineTo(-halfWidth, -halfHeight + radius);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + radius, -halfHeight);

  const geometry = new THREE.ShapeGeometry(shape, 32);
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  const uvs: number[] = [];

  for (let index = 0; index < positions.count; index += 1) {
    uvs.push((positions.getX(index) + halfWidth) / width, (positions.getY(index) + halfHeight) / height);
  }

  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  return geometry;
}

interface LanyardProps {
  position?: [number, number, number];
  gravity?: [number, number, number];
  fov?: number;
  transparent?: boolean;
}

export default function Lanyard({
  position = [0, 0, 30],
  gravity = [0, -40, 0],
  fov = 20,
  transparent = true,
}: LanyardProps) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768
  );
  const canvasKey = isMobile ? "m" : "d";

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Mobile: pull camera back and narrow FOV slightly so the badge appears
  // smaller and centered within the upper wrapper. Desktop preserves the
  // exact incoming `position`/`fov` values from the caller.
  // Memoized to keep stable object identity across renders — passing a fresh
  // `camera={{...}}` object on every render causes R3F to reconcile the
  // camera and can trigger "insertBefore" DOM races during resize.
  const cameraProps = useMemo(
    () => ({
      position: (isMobile ? [0, 0, 29] : position) as [number, number, number],
      fov: isMobile ? 20 : fov,
    }),
    [isMobile, position, fov]
  );
  const anchorX = isMobile ? 0 : 4;

  // PR-A runtime perf: cap DPR (Retina screens default up to 2–3, which is
  // imperceptible at this badge size) and slightly relax physics timeStep on
  // mobile. Visual result is indistinguishable; CPU/GPU cost drops noticeably.
  const physicsTimeStep = isMobile ? 1 / 50 : 1 / 60;

  // Perf: pause the entire render loop (Three + Rapier physics) when the
  // badge is off-screen, so it stops competing with scroll for the main
  // thread further down the page. rootMargin=200px gives the physics enough
  // lead time to start simulating BEFORE the wrapper is visible, eliminating
  // any risk of seeing a frozen pose on re-entry.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrapperRef} className="lanyard-wrapper">
      <Canvas
        key={canvasKey}
        camera={cameraProps}
        dpr={[1, 1.5]}
        frameloop={active ? "always" : "never"}
        gl={{ alpha: transparent }}
        onCreated={({ gl }) =>
          gl.setClearColor(new THREE.Color(0x000000), transparent ? 0 : 1)
        }
      >
        <ambientLight intensity={Math.PI} />
        <Physics gravity={gravity} timeStep={physicsTimeStep}>
          {/* Mobile: anchorX=0 centers the lanyard fixed point horizontally
              so the card hangs in the middle of the (upper) wrapper area.
              Desktop: keeps the original anchorX=4 (top-right anchor). */}
          <Band isMobile={isMobile} anchorX={anchorX} />
        </Physics>
        <Environment blur={0.75}>
          <Lightformer
            intensity={2}
            color="white"
            position={[0, -1, 5]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={3}
            color="white"
            position={[-1, -1, 1]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={3}
            color="white"
            position={[1, 1, 1]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={10}
            color="white"
            position={[-10, 0, 14]}
            rotation={[0, Math.PI / 2, Math.PI / 3]}
            scale={[100, 10, 1]}
          />
        </Environment>
      </Canvas>
    </div>
  );
}


interface BandProps {
  maxSpeed?: number;
  minSpeed?: number;
  isMobile?: boolean;
  anchorX?: number;
}

function Band({ maxSpeed = 50, minSpeed = 0, isMobile = false, anchorX = 0 }: BandProps) {
  const band = useRef<any>(),
    fixed = useRef<any>(),
    j1 = useRef<any>(),
    j2 = useRef<any>(),
    j3 = useRef<any>(),
    card = useRef<any>();
  const vec = new THREE.Vector3(),
    ang = new THREE.Vector3(),
    rot = new THREE.Vector3(),
    dir = new THREE.Vector3();
  const segmentProps: any = {
    type: "dynamic",
    canSleep: true,
    colliders: false,
    angularDamping: isMobile ? 24 : 16,
    linearDamping: isMobile ? 22 : 16,
  };

  const { nodes, materials } = useGLTF(cardGLB) as any;
  const texture = useTexture(lanyard);
  const frontTexture = useTexture(cardFrontImg);
  const backTexture = useTexture(cardBackImg);
  const { width, height, radius, centerY, frontZ, backZ } = CARD_FACE_CONFIG;
  const faceGeometry = useMemo(
    () => createRoundedFaceGeometry(width, height, radius),
    [width, height, radius]
  );
  const backFaceGeometry = useMemo(
    () => createRoundedFaceGeometry(width * 1.06, height * 1.04, radius),
    [width, height, radius]
  );
  const [curve] = useState(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ])
  );
  const [dragged, drag] = useState<false | THREE.Vector3>(false);
  const [hovered, hover] = useState(false);
  const downInfo = useRef<{ time: number; point: THREE.Vector3 } | null>(null);
  const pointerMovedRef = useRef(false);
  const [flipped, setFlipped] = useState(false);
  const [showBackFace, setShowBackFace] = useState(false);
  const flipGroup = useRef<THREE.Group>(null);
  const [bandReady, setBandReady] = useState(false);
  const settledFramesRef = useRef(0);

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1] as any);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1] as any);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1] as any);
  useSphericalJoint(j3, card, [
    [0, 0, 0],
    [0, 1.5, 0],
  ] as any);

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? "grabbing" : "grab";
      return () => void (document.body.style.cursor = "auto");
    }
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    if (dragged && typeof dragged !== "boolean") {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, j1, j2, j3, fixed].forEach((ref) => ref.current?.wakeUp());
      card.current?.setNextKinematicTranslation({
        x: vec.x - dragged.x,
        y: vec.y - dragged.y,
        z: vec.z - dragged.z,
      });
    }
    if (fixed.current) {
      const refsReady = [card, j1, j2, j3, fixed].every((ref) => {
        const translation = ref.current?.translation?.();
        return translation && Number.isFinite(translation.x) && Number.isFinite(translation.y) && Number.isFinite(translation.z);
      });
      if (!refsReady || !band.current) return;

      [j1, j2].forEach((ref) => {
        if (!ref.current.lerped)
          ref.current.lerped = new THREE.Vector3().copy(ref.current.translation());
        const clampedDistance = Math.max(
          0.1,
          Math.min(1, ref.current.lerped.distanceTo(ref.current.translation()))
        );
        ref.current.lerped.lerp(
          ref.current.translation(),
          delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed))
        );
      });
      curve.points[0].copy(j3.current.translation());
      curve.points[1].copy(j2.current.lerped);
      curve.points[2].copy(j1.current.lerped);
      curve.points[3].copy(fixed.current.translation());
      band.current.geometry.setPoints(curve.getPoints(isMobile ? 16 : 32));
      ang.copy(card.current.angvel());
      rot.copy(card.current.rotation());
      card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z });

      // Só revela a cord depois que o cartão caiu E a curva deixou de ser
      // (quase) horizontal — evita o "flash" de uma linha branca atravessando
      // a tela enquanto a física ainda não desceu o cartão.
      if (!bandReady) {
        const cardPos = card.current.translation();
        const anchorPos = fixed.current.translation();
        const dropped = anchorPos.y - cardPos.y;
        const horizontalSpan = Math.abs(cardPos.x - anchorPos.x);
        // Exige queda significativa E que a corda já seja mais vertical que horizontal.
        const isVertical = dropped > horizontalSpan * 0.9;
        if (dropped > 2.2 && isVertical) {
          settledFramesRef.current += 1;
          if (settledFramesRef.current > 8) setBandReady(true);
        } else {
          settledFramesRef.current = 0;
        }
      }

    }
    // Smooth flip animation around the card's local Y axis
    if (flipGroup.current) {
      const target = flipped ? Math.PI : 0;
      flipGroup.current.rotation.y = THREE.MathUtils.lerp(
        flipGroup.current.rotation.y,
        target,
        Math.min(1, delta * 6)
      );
      setShowBackFace(Math.cos(flipGroup.current.rotation.y) < 0);
    }
  });

  curve.curveType = "chordal";
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  frontTexture.colorSpace = backTexture.colorSpace = THREE.SRGBColorSpace;
  frontTexture.wrapS = frontTexture.wrapT = THREE.ClampToEdgeWrapping;
  backTexture.wrapS = backTexture.wrapT = THREE.ClampToEdgeWrapping;

  return (
    <>
      <group position={[0, isMobile ? 7 : 4, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" position={[anchorX, 0, 0]} />
        <RigidBody position={[anchorX + 0.5, 0, 0]} ref={j1} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[anchorX + 1, 0, 0]} ref={j2} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[anchorX + 1.5, 0, 0]} ref={j3} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody
          position={[anchorX + 2, 0, 0]}
          ref={card}
          {...segmentProps}
          type={dragged ? "kinematicPosition" : "dynamic"}
        >
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            scale={2.25}
            position={[0, -1.2, -0.05]}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={(e: any) => {
              e.target.releasePointerCapture(e.pointerId);
              const info = downInfo.current;
              drag(false);
              if (info) {
                const dt = performance.now() - info.time;
                const dist = e.point.distanceTo(info.point);
                // Tap = no meaningful pointer movement + short duration.
                // Use pointerMovedRef (not `dragged`) so mobile taps still
                // register as flips even when initial drag-arming occurred.
                if (!pointerMovedRef.current && dt < 250 && dist < 0.15) {
                  setFlipped((f) => !f);
                }
              }
              downInfo.current = null;
              pointerMovedRef.current = false;
            }}
            onPointerDown={(e: any) => {
              e.stopPropagation();
              if (isMobile) e.nativeEvent?.preventDefault?.();
              e.target.setPointerCapture(e.pointerId);
              pointerMovedRef.current = false;
              downInfo.current = {
                time: performance.now(),
                point: new THREE.Vector3().copy(e.point),
              };
              // NOTE: do NOT call drag(...) here on mobile — doing so made
              // every tap register as a drag, blocking the flip. The
              // onPointerMove handler below arms drag once the finger
              // actually crosses the movement threshold.
            }}
            onPointerMove={(e: any) => {
              const info = downInfo.current;
              if (!info) return;
              if (isMobile) e.nativeEvent?.preventDefault?.();
              if (e.point.distanceTo(info.point) > (isMobile ? 0.025 : 0.08)) {
                pointerMovedRef.current = true;
              }
              if (dragged) return;
              if (pointerMovedRef.current) {
                drag(
                  new THREE.Vector3()
                    .copy(e.point)
                    .sub(vec.copy(card.current.translation()))
                );
              }
            }}
          >
            <group ref={flipGroup}>
              {/* Original card body from GLB (uses model's native material) */}
              <mesh geometry={nodes.card.geometry} material={materials.base}>
                <meshPhysicalMaterial
                  clearcoat={1}
                  clearcoatRoughness={0.15}
                  roughness={0.9}
                  metalness={0.8}
                />
              </mesh>
              <mesh position={[0, centerY, frontZ]} geometry={faceGeometry} visible={!showBackFace}>
                <meshBasicMaterial
                  map={frontTexture}
                  side={THREE.FrontSide}
                  transparent
                  depthTest
                  depthWrite
                  toneMapped={false}
                />
              </mesh>
              <mesh
                position={[0, centerY, backZ]}
                rotation={[0, Math.PI, 0]}
                geometry={backFaceGeometry}
                visible={showBackFace}
              >
                <meshBasicMaterial
                  map={backTexture}
                  side={THREE.FrontSide}
                  transparent
                  depthTest
                  depthWrite
                  toneMapped={false}
                />
              </mesh>
              <mesh
                geometry={nodes.clip.geometry}
                material={materials.metal}
                material-roughness={0.3}
              />
              <mesh geometry={nodes.clamp.geometry} material={materials.metal} />
            </group>
          </group>
        </RigidBody>
      </group>
      <mesh ref={band} visible={bandReady} frustumCulled={false}>
        <meshLineGeometry />
        <meshLineMaterial
          color="white"
          depthTest={false}
          resolution={isMobile ? [1000, 2000] : [1000, 1000]}
          useMap
          map={texture}
          repeat={[-4, 1]}
          lineWidth={bandReady ? 1 : 0}
          transparent
          opacity={bandReady ? 1 : 0}
        />
      </mesh>

    </>
  );
}