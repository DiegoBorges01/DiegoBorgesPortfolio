"use client";

import * as React from "react";
import {
  type HTMLMotionProps,
  motion,
  type Transition,
  useMotionValue,
  useSpring,
} from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Bundui Stars — ported to use framer-motion (project already depends on it)
 * instead of `motion/react`. Single-file, self-contained animated starfield
 * background with a subtle parallax that follows the cursor.
 */

const STAR_COLOR_DARK = "#fff";
const STAR_COLOR_LIGHT = "#000";
const BG_START_DARK = "#262626";
const BG_END_DARK = "#000";
const BG_START_LIGHT = "#ccc";
const BG_END_LIGHT = "#fff";

type StarLayerProps = HTMLMotionProps<"div"> & {
  count: number;
  size: number;
  transition: Transition;
  isLight: boolean;
};

function generateStars(count: number, starColor: string) {
  const shadows: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * 4000) - 2000;
    const y = Math.floor(Math.random() * 4000) - 2000;
    shadows.push(`${x}px ${y}px ${starColor}`);
  }
  return shadows.join(", ");
}

function StarLayer({
  count = 1000,
  size = 1,
  transition = { repeat: Infinity, duration: 50, ease: "linear" },
  isLight,
  className,
  ...props
}: StarLayerProps) {
  const [boxShadow, setBoxShadow] = React.useState<string>("");
  const starColor = isLight ? STAR_COLOR_LIGHT : STAR_COLOR_DARK;

  React.useEffect(() => {
    setBoxShadow(generateStars(count, starColor));
  }, [count, starColor]);

  return (
    <motion.div
      data-slot="star-layer"
      animate={{ y: [0, -2000] }}
      transition={transition}
      className={cn("absolute top-0 left-0 h-[2000px] w-full", className)}
      {...props}
    >
      <div
        className="absolute rounded-full bg-transparent"
        style={{ width: `${size}px`, height: `${size}px`, boxShadow }}
      />
      <div
        className="absolute top-[2000px] rounded-full bg-transparent"
        style={{ width: `${size}px`, height: `${size}px`, boxShadow }}
      />
    </motion.div>
  );
}

type StarsBackgroundProps = React.ComponentProps<"div"> & {
  factor?: number;
  speed?: number;
  transition?: { stiffness?: number; damping?: number };
  /**
   * Mounts/unmounts the animated star layers + mouse parallax handler.
   * Default true. When false, only the flat background + children render —
   * zero rAF, zero box-shadow paint, zero spring updates.
   */
  active?: boolean;
  /**
   * Enables the mouse-move parallax. Default true. When false, the
   * onMouseMove handler is omitted (no useSpring updates on cursor move).
   */
  interactive?: boolean;
};

export function StarsBackground({
  children,
  className,
  factor = 0.05,
  speed = 50,
  transition = { stiffness: 50, damping: 20 },
  active = true,
  interactive = true,
  ...props
}: StarsBackgroundProps) {
  const offsetX = useMotionValue(1);
  const offsetY = useMotionValue(1);

  const springX = useSpring(offsetX, transition);
  const springY = useSpring(offsetY, transition);

  // PR-B: pause the animated star layers when the background is fully
  // off-screen. When invisible there's no paint cost from the huge box-shadow
  // strings and no spring/rAF activity. Resumes seamlessly when scrolled back.
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = React.useState(true);
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin: "200px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      offsetX.set(-(e.clientX - centerX) * factor);
      offsetY.set(-(e.clientY - centerY) * factor);
    },
    [offsetX, offsetY, factor],
  );

  // K3 — Site is dark-only (see index.html / index.css). The MutationObserver
  // on <html> was a no-op cost duplicated per StarsBackground instance.
  const isLight = false;

  // Pure flat background — no radial gradient, no glow. Stars are the only
  // light source on top of a homogeneous black (or white in light mode) field.
  const backgroundStyle = isLight ? "#ffffff" : "#000000";
  void BG_START_DARK; void BG_END_DARK; void BG_START_LIGHT; void BG_END_LIGHT;

  const layersActive = active && onScreen;

  return (
    <div
      ref={containerRef}
      data-slot="stars-background"
      className={cn("relative size-full overflow-hidden", className)}
      style={{ background: backgroundStyle }}
      onMouseMove={layersActive && interactive ? handleMouseMove : undefined}
      {...props}
    >
      {layersActive && (
        <motion.div style={{ x: springX, y: springY }}>
          <StarLayer
            count={1000}
            size={1}
            transition={{ repeat: Infinity, duration: speed, ease: "linear" }}
            isLight={isLight}
          />
          <StarLayer
            count={400}
            size={2}
            transition={{ repeat: Infinity, duration: speed * 2, ease: "linear" }}
            isLight={isLight}
          />
          <StarLayer
            count={200}
            size={3}
            transition={{ repeat: Infinity, duration: speed * 3, ease: "linear" }}
            isLight={isLight}
          />
        </motion.div>
      )}
      {children}
    </div>
  );
}

export default StarsBackground;