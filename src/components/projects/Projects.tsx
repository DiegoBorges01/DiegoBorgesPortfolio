"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ScrambleText } from "@/components/ui/scramble-text";
import { useIsMobileResolved } from "@/hooks/use-mobile";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    // Fullscreen triangle: vUv is derived from clip-space position so there is
    // no internal diagonal edge between two PlaneGeometry triangles.
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/**
 * Glass bubble transition shader — revela a próxima imagem através
 * de uma "bolha" líquida com refração, aberração cromática e
 * brilho de borda. Sem cortes diagonais.
 */
const fragmentShader = `
  uniform sampler2D uTexture1;
  uniform sampler2D uTexture2;
  uniform float uProgress;
  uniform vec2 uResolution;
  uniform vec2 uTexture1Size;
  uniform vec2 uTexture2Size;

  varying vec2 vUv;

  vec2 getCoverUV(vec2 uv, vec2 textureSize) {
    vec2 s = uResolution / textureSize;
    float scale = max(s.x, s.y);
    vec2 scaledSize = textureSize * scale;
    vec2 offset = (uResolution - scaledSize) * 0.5;
    return (uv * uResolution - offset) / scaledSize;
  }

  float noise(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float smoothNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(noise(i), noise(i + vec2(1.0, 0.0)), f.x),
               mix(noise(i + vec2(0.0, 1.0)), noise(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    float glassStrength = 0.08;
    float chromaticAberration = 0.02;
    float waveDistortion = 0.025;
    float clearCenterSize = 0.3;
    float surfaceRipples = 0.004;
    float liquidFlow = 0.015;
    float rimLightWidth = 0.05;
    float glassEdgeWidth = 0.025;

    float brightnessPhase = smoothstep(0.8, 1.0, uProgress);
    float rimLightIntensity = 0.08 * (1.0 - brightnessPhase);
    float glassEdgeOpacity = 0.06 * (1.0 - brightnessPhase);

    vec2 center = vec2(0.5);
    vec2 p = vUv * uResolution;
    vec2 uv1 = getCoverUV(vUv, uTexture1Size);
    vec2 uv2_base = getCoverUV(vUv, uTexture2Size);

    float maxRadius = length(uResolution) * 0.85;
    float bubbleRadius = uProgress * maxRadius;
    vec2 sphereCenter = center * uResolution;

    float dist = length(p - sphereCenter);
    float normalizedDist = dist / max(bubbleRadius, 0.001);
    vec2 direction = (dist > 0.0) ? (p - sphereCenter) / dist : vec2(0.0);
    float inside = 1.0 - smoothstep(bubbleRadius - 3.0, bubbleRadius + 3.0, dist);
    float distanceFactor = smoothstep(clearCenterSize, 1.0, normalizedDist);
    float time = uProgress * 5.0;

    vec2 liquidSurface = vec2(
      smoothNoise(vUv * 100.0 + time * 0.3),
      smoothNoise(vUv * 100.0 + time * 0.2 + 50.0)
    ) - 0.5;
    liquidSurface *= surfaceRipples * distanceFactor;

    vec2 distortedUV = uv2_base;
    if (inside > 0.0) {
      float refractionOffset = glassStrength * pow(distanceFactor, 1.5);
      vec2 flowDirection = normalize(direction + vec2(sin(time), cos(time * 0.7)) * 0.3);
      distortedUV -= flowDirection * refractionOffset;
      float combinedWave = (sin(normalizedDist * 22.0 - time * 3.5)
        + sin(normalizedDist * 35.0 + time * 2.8) * 0.7
        + sin(normalizedDist * 50.0 - time * 4.2) * 0.5) / 3.0;
      float waveOffset = combinedWave * waveDistortion * distanceFactor;
      distortedUV -= direction * waveOffset + liquidSurface;
      vec2 flowOffset = vec2(
        sin(time + normalizedDist * 10.0),
        cos(time * 0.8 + normalizedDist * 8.0)
      ) * liquidFlow * distanceFactor * inside;
      distortedUV += flowOffset;
    }

    vec4 newImg;
    if (inside > 0.0) {
      float aberrationOffset = chromaticAberration * pow(distanceFactor, 1.2);
      vec2 uv_r = distortedUV + direction * aberrationOffset * 1.2;
      vec2 uv_g = distortedUV + direction * aberrationOffset * 0.2;
      vec2 uv_b = distortedUV - direction * aberrationOffset * 0.8;
      newImg = vec4(
        texture2D(uTexture2, uv_r).r,
        texture2D(uTexture2, uv_g).g,
        texture2D(uTexture2, uv_b).b,
        1.0
      );
    } else {
      newImg = texture2D(uTexture2, uv2_base);
    }

    if (inside > 0.0 && rimLightIntensity > 0.0) {
      float rim = smoothstep(1.0 - rimLightWidth, 1.0, normalizedDist)
        * (1.0 - smoothstep(1.0, 1.01, normalizedDist));
      newImg.rgb += rim * rimLightIntensity;
      float edge = smoothstep(1.0 - glassEdgeWidth, 1.0, normalizedDist)
        * (1.0 - smoothstep(1.0, 1.01, normalizedDist));
      newImg.rgb = mix(newImg.rgb, vec3(1.0), edge * glassEdgeOpacity);
    }

    vec4 currentImg = texture2D(uTexture1, uv1);
    if (uProgress > 0.95) {
      vec4 pureNewImg = texture2D(uTexture2, uv2_base);
      float endTransition = (uProgress - 0.95) / 0.05;
      newImg = mix(newImg, pureNewImg, endTransition);
    }
    gl_FragColor = mix(currentImg, newImg, inside);
  }
`;

interface Slide {
  title: string;
  subtitle: string;
  media: string;
  /** Optional mobile-optimized asset (e.g. 1:2 portrait). Falls back to `media` on desktop or when absent. */
  mobileMedia?: string;
}

const SLIDES: Slide[] = [
  {
    title: "Prosperity",
    subtitle: "Precatórios Digital",
    media: "/projects/prosperity.webp",
    mobileMedia: "/projects/prosperity-mobile.webp",
  },
  {
    title: "A Cobiça",
    subtitle: "Premium Bakery",
    media: "/projects/cobica.webp",
  },
  {
    title: "Aquageo",
    subtitle: "Hidrogeologia & Perfuração",
    media: "/projects/aquageo.webp",
  },
  {
    title: "Cesinha",
    subtitle: "Futevôlei Salvador",
    media: "/projects/cesinha.webp",
    mobileMedia: "/projects/cesinha-mobile.webp",
  },
  {
    title: "Sincro Panel",
    subtitle: "Painel de Controle",
    media: "/projects/sincro.webp",
  },
  {
    title: "Pet Shop",
    subtitle: "Food & Accessories",
    media: "/projects/petshop.webp",
    mobileMedia: "/projects/petshop-mobile.webp",
  },
];

const TRANSITION_DURATION = 2.5;
const AUTO_SLIDE_SPEED = 5000;

function ProjectScrollHint() {
  // Light runs from inner arrow (closest to "Scroll" text) to outer arrow.
  // Left side renders left-to-right as: outer, middle, inner
  // Right side renders left-to-right as: inner, middle, outer
  // `distance` = how far from center (0 = closest to text, 2 = farthest).
  const leftArrows = [2, 1, 0]; // distance from center, in render order
  const rightArrows = [0, 1, 2];
  const stagger = 0.18;
  return (
    <div
      className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[88px] md:bottom-[96px] flex items-center gap-2 md:gap-3 select-none"
      style={{ textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}
    >
      {/* Left arrows pointing left */}
      <div className="flex items-center gap-[3px] md:gap-1">
        {leftArrows.map((distance, i) => (
          <span
            key={`l-${i}`}
            className="text-[10px] md:text-xs leading-none"
            style={{
              animation: `projectScrollArrow 1.8s ease-in-out ${distance * stagger}s infinite`,
              opacity: 0.55,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            &#8249;
          </span>
        ))}
      </div>

      <span
        className="uppercase tracking-[0.32em] text-[9px] md:text-[10px] font-medium"
        style={{ color: "rgba(255,255,255,0.85)" }}
      >
        Scroll
      </span>

      {/* Right arrows pointing right */}
      <div className="flex items-center gap-[3px] md:gap-1">
        {rightArrows.map((distance, i) => (
          <span
            key={`r-${i}`}
            className="text-[10px] md:text-xs leading-none"
            style={{
              animation: `projectScrollArrow 1.8s ease-in-out ${distance * stagger}s infinite`,
              opacity: 0.55,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            &#8250;
          </span>
        ))}
      </div>

      <style>{`
        @keyframes projectScrollArrow {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; color: #ff9f1c; }
        }
      `}</style>
    </div>
  );
}

export default function Projects() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [fullyVisible, setFullyVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const isMobile = useIsMobileResolved();
  const isMobileRef = useRef<boolean | undefined>(isMobile);
  isMobileRef.current = isMobile;

  const logicRef = useRef({
    scene: null as THREE.Scene | null,
    camera: null as THREE.OrthographicCamera | null,
    renderer: null as THREE.WebGLRenderer | null,
    material: null as THREE.ShaderMaterial | null,
    textures: [] as THREE.Texture[],
    currentSlideIndex: 0,
    isTransitioning: false,
    autoSlideTimer: null as ReturnType<typeof setTimeout> | null,
    progressInterval: null as ReturnType<typeof setInterval> | null,
    progress: 0,
    activeTween: null as gsap.core.Tween | null,
  });

  const startTimer = () => {
    const logic = logicRef.current;
    if (logic.progressInterval) clearInterval(logic.progressInterval);
    if (logic.autoSlideTimer) clearTimeout(logic.autoSlideTimer);

    logic.progress = 0;
    logic.progressInterval = setInterval(() => {
      logic.progress += (100 / AUTO_SLIDE_SPEED) * 50;
      const bar = document.getElementById(`projects-progress-${logic.currentSlideIndex}`);
      if (bar) bar.style.width = `${Math.min(logic.progress, 100)}%`;
      if (logic.progress >= 100) {
        if (logic.progressInterval) clearInterval(logic.progressInterval);
        if (!logic.isTransitioning) nextSlide();
      }
    }, 50);
  };


  const stopTimer = () => {
    const logic = logicRef.current;
    if (logic.progressInterval) clearInterval(logic.progressInterval);
    if (logic.autoSlideTimer) clearTimeout(logic.autoSlideTimer);
    const bar = document.getElementById(`projects-progress-${logic.currentSlideIndex}`);
    if (bar) bar.style.width = "0%";
  };

  const navigateTo = (index: number) => {
    const logic = logicRef.current;
    if (!logic.material) return;
    if (logic.isTransitioning) return;
    if (index === logic.currentSlideIndex) return;

    const section = sectionRef.current;
    if (section) {
      const rect = section.getBoundingClientRect();
      const fully = isMobileRef.current
        ? rect.top <= 5 && rect.bottom >= window.innerHeight - 5 && rect.width >= window.innerWidth - 5
        : isSectionViewportAligned(section) && isProjectsSliderReady();
      if (!fully) return;
    }

    logic.isTransitioning = true;
    stopTimer();

    const currTex = logic.textures[logic.currentSlideIndex];
    const nextTex = logic.textures[index];
    if (!currTex || !nextTex) {
      logic.isTransitioning = false;
      return;
    }

    logic.material.uniforms.uTexture1.value = currTex;
    logic.material.uniforms.uTexture2.value = nextTex;
    logic.material.uniforms.uTexture1Size.value = currTex.userData.size;
    logic.material.uniforms.uTexture2Size.value = nextTex.userData.size;

    let titleSwapped = false;
    logic.activeTween = gsap.fromTo(
      logic.material.uniforms.uProgress,
      { value: 0 },
      {
        value: 1,
        duration: TRANSITION_DURATION,
        ease: "power2.inOut",
        onUpdate: () => {
          if (
            !titleSwapped &&
            logic.material &&
            logic.material.uniforms.uProgress.value >= 0.5
          ) {
            titleSwapped = true;
            setActiveSlide(index);
          }
        },
        onComplete: () => {
          if (!logic.material) return;
          logic.material.uniforms.uProgress.value = 0;
          logic.material.uniforms.uTexture1.value = nextTex;
          logic.material.uniforms.uTexture1Size.value = nextTex.userData.size;
          logic.currentSlideIndex = index;
          if (!titleSwapped) setActiveSlide(index);
          logic.isTransitioning = false;
          logic.activeTween = null;
          startTimer();
        },
      }
    );
  };

  const nextSlide = () => {
    const logic = logicRef.current;
    navigateTo((logic.currentSlideIndex + 1) % SLIDES.length);
  };

  const prevSlide = () => {
    const logic = logicRef.current;
    navigateTo((logic.currentSlideIndex - 1 + SLIDES.length) % SLIDES.length);
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    // Wait until viewport size is resolved so we pick the correct
    // (desktop vs mobile) asset on the very first texture load.
    if (isMobile === undefined) return;
    const logic = logicRef.current;
    const container = canvasRef.current.parentElement!;
    const width = container.clientWidth;
    const height = container.clientHeight;

    logic.scene = new THREE.Scene();
    logic.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    logic.camera.position.z = 1;

    logic.renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: false,
      alpha: false,
    });
    const dpr = Math.min(window.devicePixelRatio, 2);
    logic.renderer.setPixelRatio(dpr);
    logic.renderer.setSize(width, height, true);
    logic.renderer.setClearColor(0x000000, 1);

    logic.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTexture1: { value: null },
        uTexture2: { value: null },
        uProgress: { value: 0.0 },
        uResolution: {
          value: new THREE.Vector2(
            logic.renderer.domElement.width,
            logic.renderer.domElement.height
          ),
        },
        uTexture1Size: { value: new THREE.Vector2(1, 1) },
        uTexture2Size: { value: new THREE.Vector2(1, 1) },
      },
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]),
        3
      )
    );
    const mesh = new THREE.Mesh(geometry, logic.material);
    mesh.frustumCulled = false;
    logic.scene.add(mesh);

    let rafId = 0;
    let renderVisible = true;
    const animate = () => {
      if (logic.renderer && logic.scene && logic.camera) {
        logic.renderer.render(logic.scene, logic.camera);
      }
      rafId = requestAnimationFrame(animate);
    };

    // V6 — pause the WebGL render loop when the section is fully off-screen.
    // Zero visual impact: lerp/uniforms are read fresh on resume.
    const renderIO = new IntersectionObserver(
      (entries) => {
        const next = entries[0]?.isIntersecting ?? true;
        if (next === renderVisible) return;
        renderVisible = next;
        if (renderVisible) {
          cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(animate);
        } else {
          cancelAnimationFrame(rafId);
        }
      },
      { rootMargin: "200px 0px" }
    );
    if (canvasRef.current?.parentElement) {
      renderIO.observe(canvasRef.current.parentElement);
    }

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");

    Promise.all(
      SLIDES.map(
        (slide) =>
          new Promise<THREE.Texture>((resolve, reject) => {
            const src =
              isMobileRef.current && slide.mobileMedia
                ? slide.mobileMedia
                : slide.media;
            loader.load(
              src,
              (tex) => {
                tex.minFilter = THREE.LinearFilter;
                tex.magFilter = THREE.LinearFilter;
                tex.userData = {
                  size: new THREE.Vector2(tex.image.width, tex.image.height),
                };
                resolve(tex);
              },
              undefined,
              reject
            );
          })
      )
    )
      .then((textures) => {
        logic.textures = textures;
        if (textures.length >= 2 && logic.material) {
          logic.material.uniforms.uTexture1.value = textures[0];
          logic.material.uniforms.uTexture2.value = textures[1];
          logic.material.uniforms.uTexture1Size.value = textures[0].userData.size;
          logic.material.uniforms.uTexture2Size.value = textures[1].userData.size;
        }
        setLoaded(true);
        animate();
      })
      .catch((err) => {
        console.error("Projects: erro ao carregar texturas", err);
      });

    const handleResize = () => {
      if (!logic.renderer || !logic.material || !canvasRef.current) return;
      const c = canvasRef.current.parentElement!;
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (w === 0 || h === 0) return;
      const nextDpr = Math.min(window.devicePixelRatio, 2);
      logic.renderer.setPixelRatio(nextDpr);
      logic.renderer.setSize(w, h, true);
      logic.material.uniforms.uResolution.value.set(
        logic.renderer.domElement.width,
        logic.renderer.domElement.height
      );
    };
    window.addEventListener("resize", handleResize);
    handleResize();

    const ro = new ResizeObserver(() => handleResize());
    ro.observe(container);

    return () => {
      window.removeEventListener("resize", handleResize);
      ro.disconnect();
      renderIO.disconnect();
      cancelAnimationFrame(rafId);
      if (logic.autoSlideTimer) clearTimeout(logic.autoSlideTimer);
      if (logic.progressInterval) clearInterval(logic.progressInterval);
      logic.renderer?.dispose();
      geometry.dispose();
      logic.material?.dispose();
      logic.textures.forEach((t) => t.dispose());
    };
    // Re-run if viewport class flips (desktop <-> mobile) so textures match.
  }, [isMobile]);

  useEffect(() => {
    if (loaded) startTimer();
    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // (Mobile no longer scrubs slides via scroll progress — touch swipes now
  // drive discrete transitions just like wheel events on desktop.)


  useEffect(() => {
    if (!loaded) return;
    const section = sectionRef.current;
    if (!section) return;

    let visible = false;
    const check = () => {
      const rect = section.getBoundingClientRect();
      const fully = isMobileRef.current
        ? rect.top <= 5 && rect.bottom >= window.innerHeight - 5 && rect.width >= window.innerWidth - 5
        : isSectionViewportAligned(section) && isProjectsSliderReady();
      if (fully && !visible) {
        visible = true;
        setFullyVisible(true);
        startTimer();
      } else if (!fully && visible) {
        visible = false;
        setFullyVisible(false);
        stopTimer();
        const logic = logicRef.current;
        if (logic.activeTween) {
          logic.activeTween.kill();
          logic.activeTween = null;
        }
        if (logic.material) {
          logic.material.uniforms.uProgress.value = 0;
          const curr = logic.textures[logic.currentSlideIndex];
          if (curr) {
            logic.material.uniforms.uTexture1.value = curr;
            logic.material.uniforms.uTexture1Size.value = curr.userData.size;
          }
        }
        logic.isTransitioning = false;
      }
    };
    stopTimer();
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    window.addEventListener("projects-title-state", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      window.removeEventListener("projects-title-state", check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const getViewportHeight = () => window.visualViewport?.height ?? window.innerHeight;

  const getProjectsTitleState = () =>
    (window as unknown as {
      __projectsTitleState?: {
        sliderActive: boolean;
        progress: number;
        direction: 1 | -1;
        start: number;
        end: number;
        sliderStart: number;
      };
      __projectsSliderActive?: boolean;
    }).__projectsTitleState;

  const isProjectsSliderReady = () => {
    const state = getProjectsTitleState();
    if (state) return state.sliderActive;
    return Boolean((window as unknown as { __projectsSliderActive?: boolean }).__projectsSliderActive);
  };

  const isSectionViewportAligned = (section: HTMLElement) => {
    const rect = section.getBoundingClientRect();
    const viewportHeight = getViewportHeight();
    return (
      rect.top <= 5 &&
      rect.bottom >= viewportHeight - 5 &&
      rect.width >= window.innerWidth - 5
    );
  };

  useEffect(() => {
    if (!loaded) return;
    const section = sectionRef.current;
    if (!section) return;

    let lastWheelAt = 0;
    const COOLDOWN = 700;
    const lenis = (
      window as unknown as {
        __lenis?: {
          stop: () => void;
          start: () => void;
        };
      }
    ).__lenis;
    let locked = false;

    const lock = () => {
      if (locked) return;
      locked = true;
      lenis?.stop();
    };
    const unlock = () => {
      if (!locked) return;
      locked = false;
      lenis?.start();
    };

    const onWheel = (e: WheelEvent) => {
      const rect = section.getBoundingClientRect();
      const fully = isMobileRef.current
        ? rect.top <= 5 && rect.bottom >= window.innerHeight - 5 && rect.width >= window.innerWidth - 5
        : isSectionViewportAligned(section) && isProjectsSliderReady();
      if (!fully) {
        unlock();
        return;
      }

      const delta =
        Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(delta) < 4) return;
      const dir = delta > 0 ? 1 : -1;

      const idx = logicRef.current.currentSlideIndex;
      const atLast = idx === SLIDES.length - 1;
      const atFirst = idx === 0;

      if ((dir > 0 && atLast) || (dir < 0 && atFirst)) {
        unlock();
        return;
      }

      lock();
      e.preventDefault();
      e.stopImmediatePropagation();

      const now = performance.now();
      if (now - lastWheelAt < COOLDOWN) return;
      if (Math.abs(delta) < 8) return;
      lastWheelAt = now;
      if (dir > 0) nextSlide();
      else prevSlide();
    };

    window.addEventListener("wheel", onWheel, { passive: false, capture: true });

    // --- Mobile/touch: mirror the wheel behavior so swipes drive slide
    // transitions instead of scrolling to the next section, until the user
    // reaches the first/last slide (then natural scroll resumes). ---
    let touchStartY = 0;
    let touchStartX = 0;
    let touchAccum = 0;
    let touchLocked = false;
    let lastTouchTriggerAt = 0;
    const TOUCH_THRESHOLD = 45;
    const TOUCH_COOLDOWN = 700;

    const isFullyVisibleMobile = () => {
      const rect = section.getBoundingClientRect();
      return (
        rect.top <= 5 &&
        rect.bottom >= window.innerHeight - 5 &&
        rect.width >= window.innerWidth - 5
      );
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!isMobileRef.current) return;
      const t = e.touches[0];
      if (!t) return;
      touchStartY = t.clientY;
      touchStartX = t.clientX;
      touchAccum = 0;
      touchLocked = false;
      // Do NOT lock here — locking eagerly on touchstart freezes Lenis even
      // when the user is at the last slide trying to exit the section, which
      // forces them to swipe multiple times. Lock only inside onTouchMove,
      // after we confirm we will actually consume the swipe.
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isMobileRef.current) return;
      if (!isFullyVisibleMobile()) {
        unlock();
        return;
      }
      const t = e.touches[0];
      if (!t) return;

      const dy = touchStartY - t.clientY; // swipe up => positive
      const dx = touchStartX - t.clientX;
      // Ignore predominantly horizontal swipes.
      if (Math.abs(dx) > Math.abs(dy) * 1.2) return;

      const idx = logicRef.current.currentSlideIndex;
      const dir = dy > 0 ? 1 : -1;
      const atLast = idx === SLIDES.length - 1;
      const atFirst = idx === 0;

      // At boundaries in the swipe direction, release control to allow the
      // page to scroll naturally to adjacent sections.
      if ((dir > 0 && atLast) || (dir < 0 && atFirst)) {
        unlock();
        return;
      }

      lock();
      e.preventDefault();
      e.stopImmediatePropagation();

      touchAccum = dy;
      const now = performance.now();
      if (touchLocked) return;
      if (Math.abs(touchAccum) < TOUCH_THRESHOLD) return;
      if (now - lastTouchTriggerAt < TOUCH_COOLDOWN) return;
      touchLocked = true;
      lastTouchTriggerAt = now;
      if (dir > 0) nextSlide();
      else prevSlide();
    };

    const onTouchEnd = () => {
      touchAccum = 0;
      touchLocked = false;
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true, capture: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true, capture: true });

    return () => {
      window.removeEventListener("wheel", onWheel, { capture: true } as EventListenerOptions);
      window.removeEventListener("touchstart", onTouchStart, { capture: true } as EventListenerOptions);
      window.removeEventListener("touchmove", onTouchMove, { capture: true } as EventListenerOptions);
      window.removeEventListener("touchend", onTouchEnd, { capture: true } as EventListenerOptions);
      window.removeEventListener("touchcancel", onTouchEnd, { capture: true } as EventListenerOptions);
      unlock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);


  return (
    <section
      ref={sectionRef}
      className="relative w-full h-screen overflow-hidden bg-background select-none font-mono"
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest(".projects-nav")) nextSlide();
      }}
    >
      {/* WebGL background layer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* UI Layer */}
      <div
        className="absolute inset-0 z-20 pointer-events-none text-foreground transition-opacity duration-150"
        style={{ opacity: fullyVisible ? 1 : 0 }}
      >
        {/* Projeto em destaque — top-right */}
        <div
          className="absolute top-6 right-4 md:right-8 flex flex-col gap-1.5 items-end text-right max-w-[200px] md:max-w-[420px]"
          style={{
            textShadow:
              "0 1px 2px rgba(0,0,0,0.85), 0 2px 12px rgba(0,0,0,0.65)",
          }}
        >
          <span className="uppercase tracking-[0.22em] text-[9px] md:text-[10px] font-medium text-white/80">
            Projeto em Destaque
          </span>
          <ScrambleText
            key={`title-${activeSlide}`}
            text={SLIDES[activeSlide].title}
            trigger={activeSlide}
            duration={0.9}
            className="uppercase font-black italic tracking-tight text-xl md:text-3xl leading-none text-white"
          />
          <ScrambleText
            key={`sub-${activeSlide}`}
            text={SLIDES[activeSlide].subtitle}
            trigger={activeSlide}
            duration={1.1}
            className="text-[10px] md:text-[12px] text-white/90 tracking-wide"
          />
        </div>

        {/* Contador atual — meio esquerda */}
        <div className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 text-[11px] md:text-[13px] font-medium tabular-nums tracking-wider">
          {String(activeSlide + 1).padStart(2, "0")}
        </div>

        {/* Total — meio direita */}
        <div className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 text-[11px] md:text-[13px] font-medium tabular-nums tracking-wider">
          {String(SLIDES.length).padStart(2, "0")}
        </div>

        {/* Bottom navigation
            Desktop: grid-cols-6 gap-6 — preserved exactly.
            Mobile:  grid-cols-3 gap-3 with 2 rows (natural grid flow),
                     slightly smaller text to fit 3 items per row. */}
        <div className="projects-nav pointer-events-auto absolute bottom-6 left-0 right-0 px-4 md:px-8">
          <div className="grid grid-cols-3 gap-3 md:grid-cols-6 md:gap-6">
            {SLIDES.map((slide, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  navigateTo(idx);
                }}
                className="group relative flex flex-col items-start gap-1.5 md:gap-2 text-left"
              >
                <div className="h-px w-full bg-foreground/20 overflow-hidden">
                  <div
                    id={`projects-progress-${idx}`}
                    className="h-full bg-foreground transition-[width] duration-100"
                    style={{ width: idx === activeSlide ? undefined : "0%" }}
                  />
                </div>
                <span
                  className={`uppercase tracking-[0.12em] md:tracking-[0.18em] text-[9px] md:text-[11px] font-medium transition-colors ${
                    idx === activeSlide
                      ? "text-foreground"
                      : "text-foreground/55 group-hover:text-foreground/80"
                  }`}
                >
                  {slide.title}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Scroll hint — visible whenever the section is fully active */}
        <div
          className="absolute inset-x-0 bottom-0 z-10 transition-opacity duration-500"
          style={{ opacity: fullyVisible ? 1 : 0 }}
        >
          <ProjectScrollHint />
        </div>
      </div>
    </section>
  );
}
