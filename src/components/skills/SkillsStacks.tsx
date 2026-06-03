"use client";

import { lazy, Suspense } from "react";
import { StarsBackground } from "./StarsBackground";

const KeyboardScene = lazy(() => import("./KeyboardScene"));

// ─── Main Section ─────────────────────────────────────────
export default function SkillsStacks() {
  return (
    <section
      id="skills"
      aria-label="Skills & Stacks"
      className="relative w-full overflow-x-clip"
    >
      <StarsBackground
        interactive={false}
        className="relative flex min-h-screen w-full items-center justify-center overflow-x-clip bg-black"
      >
        <div className="pointer-events-none absolute inset-x-0 top-12 md:top-16 z-20 mx-auto flex flex-col items-center text-center">
          <h2 className="font-black tracking-tight text-white text-5xl md:text-7xl leading-none">
            Skills Stack
          </h2>
          <p className="mt-3 text-sm md:text-base text-white/70">
            (hint: press a key)
          </p>
        </div>

        <div className="relative z-10 flex w-full max-w-[1600px] items-center justify-center px-0 md:px-8">
          <div className="w-full overflow-visible">
            <Suspense fallback={null}>
              <KeyboardScene />
            </Suspense>
          </div>
        </div>
      </StarsBackground>
    </section>
  );
}
