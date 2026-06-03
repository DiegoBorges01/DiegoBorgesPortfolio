"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

// URLs públicas — mesmos arquivos, mesma qualidade, fora do bundle JS.
const journey1  = "/journey/journey-1.webp";
const journey2  = "/journey/journey-2.webp";
const journey3  = "/journey/journey-3.webp";
const journey4  = "/journey/journey-4.webp";
const journey5  = "/journey/journey-5.webp";
const journey6  = "/journey/journey-6.webp";
const journey7  = "/journey/journey-7.webp";
const journey8  = "/journey/journey-8.webp";
const journey9  = "/journey/journey-9.webp";
const journey10 = "/journey/journey-10.webp";
const journey11 = "/journey/journey-11.webp";
const journey12 = "/journey/journey-12.webp";

// Desktop widths preserved exactly as original.
// Mobile widths added via responsive Tailwind classes (no md: class = mobile-first base).
const TOP_ROW = [
  { src: journey1,  width: "w-[180px] md:w-[300px]" },
  { src: journey2,  width: "w-[280px] md:w-[500px]" },
  { src: journey11, width: "w-[220px] md:w-[400px]" },
  { src: journey4,  width: "w-[320px] md:w-[600px]" },
  { src: journey5,  width: "w-[200px] md:w-[350px]" },
  { src: journey6,  width: "w-[250px] md:w-[450px]" },
];

const BOTTOM_ROW = [
  { src: journey7,  width: "w-[220px] md:w-[400px]" },
  { src: journey8,  width: "w-[180px] md:w-[300px]" },
  { src: journey9,  width: "w-[300px] md:w-[550px]" },
  { src: journey10, width: "w-[230px] md:w-[420px]" },
  { src: journey3,  width: "w-[210px] md:w-[380px]" },
  { src: journey12, width: "w-[280px] md:w-[500px]" },
];

export default function HorizontalParallax() {
  const targetRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start end", "end start"],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const x = useTransform(smoothProgress, [0, 1], ["0%", "-40%"]);
  const topY = useTransform(smoothProgress, [0, 0.5, 1], [0, -150, -300]);
  const bottomY = useTransform(smoothProgress, [0, 0.5, 1], [0, 150, 300]);
  const textScale = useTransform(smoothProgress, [0, 0.5], [0.7, 1.2]);
  const textOpacity = useTransform(smoothProgress, [0, 0.4, 0.8], [0, 1, 0]);

  return (
    // The sticky child's own `overflow-hidden` clips the gallery visually.
    // CSS transforms (Framer Motion x) do not contribute to scroll-width,
    // so no overflow-x is needed here — and adding it would risk breaking
    // sticky behaviour in Safari iOS.
    // The body already carries `overflow-x: hidden` via index.css as a fallback.
    <section ref={targetRef} className="relative h-[150vh] bg-background">
      <div className="sticky top-0 h-screen flex items-center overflow-hidden">
        <motion.div
          style={{ scale: textScale, opacity: textOpacity }}
          className="absolute inset-0 flex flex-col items-center justify-center z-0 text-center px-6"
        >
          <h2 className="text-white text-6xl md:text-8xl font-black tracking-tighter uppercase italic">
            My Journey
          </h2>
        </motion.div>

        <motion.div style={{ x }} className="flex flex-col gap-6 md:gap-8 pl-[6vw] md:pl-[10vw]">
          {/* Card height reduced slightly on mobile for better proportions */}
          <motion.div style={{ y: topY }} className="flex gap-4 md:gap-8">
            {TOP_ROW.map((img, i) => (
              <div
                key={i}
                className={`${img.width} h-[28vh] md:h-[35vh] flex-shrink-0 overflow-hidden rounded-xl md:rounded-2xl border border-white/10`}
              >
                <img
                  src={img.src}
                  className="w-full h-full object-cover"
                  alt="portfolio"
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                />
              </div>
            ))}
          </motion.div>

          <motion.div style={{ y: bottomY }} className="flex gap-4 md:gap-8">
            {BOTTOM_ROW.map((img, i) => (
              <div
                key={i}
                className={`${img.width} h-[28vh] md:h-[35vh] flex-shrink-0 overflow-hidden rounded-xl md:rounded-2xl border border-white/10`}
              >
                <img
                  src={img.src}
                  className="w-full h-full object-cover"
                  alt="portfolio"
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                />
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
