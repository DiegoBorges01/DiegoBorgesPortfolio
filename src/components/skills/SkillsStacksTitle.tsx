"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useMotionTemplate } from "framer-motion";
import { StarsBackground } from "./StarsBackground";

/**
 * SkillsStacksTitle
 * Circular clip-path reveal of the real <SkillsStacks /> universe
 * (black starfield) over the "Skills" wordmark.
 */
export default function SkillsStacksTitle() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Radius in % of the largest viewport dimension. 0 = invisible,
  // ~75% covers the entire screen on most aspect ratios.
  const radius = useTransform(
    scrollYProgress,
    [0, 0.08, 0.85, 1],
    [0, 0, 75, 75]
  );
  const clipPath = useMotionTemplate`circle(${radius}% at 50% 50%)`;

  // Wordmark sempre 100% opaco — o reveal por clip-path já cobre o texto.
  const textOpacity = useTransform(scrollYProgress, [0, 1], [1, 1]);

  return (
    <section
      ref={containerRef}
      aria-label="Skills"
      className="relative w-full bg-[#08090a]"
      style={{ height: "250vh" }}
    >
      <h2 className="sr-only">Skills</h2>

      {/* K2 (partial) — contain: strict isolates layout/paint of this sticky
          stage from the rest of the document. translateZ(0) promotes it to
          its own compositor layer. No will-change: clip-path (per request). */}
      <div
        className="sticky top-0 h-screen w-full overflow-hidden"
        style={{ contain: "strict", transform: "translateZ(0)" }}
      >
        {/* Smooth transition from Projects — fades the harsh cut to black */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-40 h-28"
          style={{
            background:
              "linear-gradient(to bottom, rgba(255,255,255,0.07) 0%, rgba(8,9,10,0.55) 55%, transparent 100%)",
          }}
        />

        {/* Base layer: dark background + wordmark */}
        <div className="absolute inset-0 flex items-center justify-center bg-[#08090a]">
          <motion.span
            aria-hidden
            style={{ opacity: textOpacity }}
            className="pointer-events-none select-none font-black tracking-tighter text-white text-[28vw] md:text-[18vw] leading-none"
          >
            Skills
          </motion.span>
        </div>

        {/* Reveal layer: real SkillsStacks background, masked by a circle */}
        <motion.div
          style={{
            clipPath,
            WebkitClipPath: clipPath as unknown as string,
            // K2 (partial) — isolate paint of the masked layer so the giant
            // starfield repaint doesn't invalidate the rest of the page.
            contain: "paint",
            transform: "translateZ(0)",
          }}
          className="absolute inset-0 pointer-events-none"
        >
          {/* Reverted to always-on starfield with parallax to restore the
              original visual continuity between Title and SkillsStacks. */}
          <StarsBackground className="h-full w-full bg-black" />
        </motion.div>
      </div>
    </section>
  );
}
