"use client";

import React, { useEffect, useRef, lazy, Suspense } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
const Projects = lazy(() => import("./Projects"));

interface ProjectsTitleProps {
  introTop?: string;
  introBottom?: string;
}

/**
 * ProjectsTitle — seção de transição entre My Journey e Projects.
 *
 * Comportamento:
 * - Pin de scroll que dura 400% da viewport.
 * - Frase "Conheça Meus / Projetos" perfeitamente centralizada (flex full-screen).
 * - A seção Projects (slider WebGL) abre/escala a partir do centro,
 *   enquanto a frase faz fade-out.
 */
const ProjectsTitle: React.FC<ProjectsTitleProps> = ({
  introTop = "Conheça Meus",
  introBottom = "Projetos",
}) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const topLineRef = useRef<HTMLHeadingElement>(null);
  const bottomLineRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const section = sectionRef.current;
    const reveal = revealRef.current;
    if (!section || !reveal) return;

    const mm = gsap.matchMedia();
    const viewportHeight = () => window.visualViewport?.height ?? window.innerHeight;

    mm.add(
      {
        isMobile: "(max-width: 767px)",
        isDesktop: "(min-width: 768px)",
      },
      (context) => {
        const isMobileViewport = Boolean(context.conditions?.isMobile);
        const pinDistance = 380;
        const revealDistance = 180;
        const revealFraction = revealDistance / pinDistance;

        const publishState = (self: ScrollTrigger, revealProgress: number) => {
          const sliderActive = self.isActive && revealProgress >= 0.995;
          const state = {
            sliderActive,
            progress: self.progress,
            direction: self.direction as 1 | -1,
            start: self.start,
            end: self.end,
            sliderStart: self.start + (self.end - self.start) * revealFraction,
          };
          (window as unknown as { __projectsSliderActive?: boolean }).__projectsSliderActive =
            sliderActive;
          (window as unknown as { __projectsTitleState?: typeof state }).__projectsTitleState = state;
          window.dispatchEvent(new CustomEvent("projects-title-state", { detail: state }));
        };

        gsap.set(reveal, { scale: 0 });
        gsap.set(topLineRef.current, { y: 0 });
        gsap.set(bottomLineRef.current, { y: 0 });




        const trigger = ScrollTrigger.create({
          trigger: section,
          start: "top top",
          end: () => `+=${pinDistance}%`,
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
          scrub: 1,
          invalidateOnRefresh: true,
          onRefresh: (self) => publishState(self, 0),
          onUpdate: (self) => {
            const rawProgress = self.progress;
            const progress = Math.min(rawProgress / revealFraction, 1);

            gsap.set(reveal, { scale: progress });

            if (progress <= 0.9) {
              const textProgress = progress / 0.9;
              const splitRatio = isMobileViewport ? 0.38 : 0.55;
              const splitDistance = viewportHeight() * splitRatio * textProgress;

              gsap.set(topLineRef.current, { y: -splitDistance });
              gsap.set(bottomLineRef.current, { y: splitDistance });
            }

            const introOpacity =
              progress > 0.85 ? Math.max(0, 1 - (progress - 0.85) / 0.1) : 1;
            gsap.set(introRef.current, { opacity: introOpacity });

            publishState(self, progress);
          },
          onLeave: (self) => {
            publishState(self, 0);
          },
          onLeaveBack: (self) => {
            publishState(self, 0);
          },
        });

        return () => {
          trigger.kill();
          (window as unknown as { __projectsSliderActive?: boolean }).__projectsSliderActive = false;
        };
      }
    );

    return () => {
      mm.revert();
      (window as unknown as { __projectsSliderActive?: boolean }).__projectsSliderActive = false;
    };
  }, []);


  return (
    <section
      ref={sectionRef}
      data-projects-title-section
      className="relative w-screen h-screen overflow-hidden bg-background"
    >
      {/* Frase centralizada full-screen
          Desktop: text-[8rem]  — preserved via md: class.
          Mobile:  text-6xl (3.75rem / 60px) — original value, preserved as-is. */}
      <div
        ref={introRef}
        className="absolute inset-0 flex flex-col items-center justify-center z-30 pointer-events-none px-8 text-center"
      >
        <h2
          ref={topLineRef}
          className="text-foreground uppercase font-black italic tracking-tighter leading-[0.95] text-6xl md:text-[8rem] will-change-transform"
        >
          {introTop}
        </h2>
        <h2
          ref={bottomLineRef}
          className="text-foreground uppercase font-black italic tracking-tighter leading-[0.95] text-6xl md:text-[8rem] will-change-transform"
        >
          {introBottom}
        </h2>
      </div>

      {/* Projects revelando-se a partir do centro */}
      <div
        ref={revealRef}
        className="absolute inset-0 z-20 will-change-transform origin-center overflow-hidden"
        style={{ transform: "scale(0)" }}
      >
        <Suspense fallback={<div className="absolute inset-0 bg-background" />}>
          <Projects />
        </Suspense>
      </div>
    </section>
  );
};

export default ProjectsTitle;
