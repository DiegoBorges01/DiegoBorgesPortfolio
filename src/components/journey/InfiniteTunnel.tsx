"use client";

import React, { useEffect, useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  MotionValue,
} from "framer-motion";

// URLs públicas — mesmos arquivos, mesma qualidade, fora do bundle JS.
const journey1               = "/journey/my-1.webp";
const journey2               = "/journey/my-2.webp";
const journey3               = "/journey/my-3.webp";
const journey4               = "/journey/my-4.webp";
const journey5               = "/journey/my-5.webp";
const journey6               = "/journey/my-6.webp";
const journey7               = "/journey/my-7.webp";
const journey8               = "/journey/my-8.webp";
const builderMobile          = "/journey/builder-mobile.webp";
const leaderMobile           = "/journey/leader-mobile.webp";
const realImpactMobile       = "/journey/real-impact-mobile.webp";
const marketConnectionMobile = "/journey/market-connection-mobile.webp";
const nextPartnerMobile      = "/journey/next-partner-mobile.webp";
import { useIsMobile } from "@/hooks/use-mobile";

const STORY_LAYERS = [
  {
    title: "The Builder",
    desc: "Minha jornada começou na Engenharia da Computação, onde aprendi a transformar lógica, tecnologia e visão estratégica em soluções capazes de resolver problemas reais. O inglês fluente é a ponte que me permite colaborar com qualquer time, em qualquer lugar.",
    img: journey1,
    mobileImg: builderMobile,
    color: "text-emerald-400",
  },
  {
    title: "The Foundation",
    desc: "Construí uma base técnica sólida em Java, JavaScript, Python, PHP, MySQL, APIs REST, POO e Estruturas de Dados para desenvolver sistemas confiáveis, escaláveis e bem estruturados.",
    img: journey2,
    color: "text-blue-400",
  },
  {
    title: "The Leader",
    desc: "Como líder de turma e monitor em disciplinas técnicas, desenvolvi algo essencial para qualquer projeto: clareza na comunicação, responsabilidade, liderança e capacidade de simplificar o complexo.",
    img: journey3,
    mobileImg: leaderMobile,
    color: "text-orange-400",
    objectPosition: "center 12%",
    mobileObjectPosition: "center 8%",
  },
  {
    title: "Real Impact",
    desc: "Minha experiência foi construída em projetos reais para empresas como Laweb, Prosperity Precatórios, Pirilampo, Aquageo e Inano, sempre com foco em performance, usabilidade e entrega de valor.",
    img: journey4,
    mobileImg: realImpactMobile,
    color: "text-cyan-400",
  },
  {
    title: "The Automator",
    desc: "Com automações, integrações e n8n, passei a criar soluções que economizam tempo, reduzem processos manuais e tornam operações mais inteligentes, rápidas e eficientes.",
    img: journey5,
    color: "text-purple-400",
  },
  {
    title: "Strategic Vision",
    desc: "Na Pirilampo, atuei como braço estratégico em desenvolvimento e automação, contribuindo para soluções digitais pensadas não apenas para funcionar, mas para gerar crescimento e resultado.",
    img: journey6,
    color: "text-pink-400",
  },
  {
    title: "Market Connection",
    desc: "No Hub Conecta, fortaleço minha conexão com inovação, mercado e oportunidades reais, mantendo minha visão alinhada ao que empresas realmente precisam: tecnologia aplicada com propósito.",
    img: journey7,
    mobileImg: marketConnectionMobile,
    color: "text-indigo-400",
    objectPosition: "center 12%",
    mobileObjectPosition: "center 8%",
  },
  {
    title: "The Next Partner",
    desc: "Hoje uno engenharia, design, IA, automação e desenvolvimento web para criar soluções digitais que ajudam empresas a atrair clientes, vender mais, economizar tempo e crescer com inteligência.",
    img: journey8,
    mobileImg: nextPartnerMobile,
    color: "text-white",
    objectPosition: "center 12%",
    mobileObjectPosition: "center 8%",
  },
];

export default function InfiniteTunnel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Preload agressivo das imagens críticas da jornada antes do scroll chegar.
  useEffect(() => {
    const critical = [
      journey1, journey2, journey3,
      builderMobile, leaderMobile,
    ];
    critical.forEach((src) => {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    });
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const total = STORY_LAYERS.length;

  return (
    <div ref={containerRef} className="relative h-[1000vh] bg-[#050505]" style={{ touchAction: "pan-y" }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center" style={{ touchAction: "pan-y" }}>

        {/* PROGRESS INDICATOR
            Desktop: left-10 (2.5rem / 40px) — preserved exactly.
            Mobile:  left-3  (0.75rem / 12px) — tighter to edge, less overlap with card. */}
        <div className="absolute left-3 md:left-10 z-50 flex flex-col gap-3 md:gap-4">
          {STORY_LAYERS.map((_, i) => (
            <ProgressBar key={i} index={i} total={total} progress={smoothProgress} />
          ))}
        </div>

        {/* RENDER LAYERS */}
        {STORY_LAYERS.map((layer, index) => (
          <Layer
            key={index}
            data={layer}
            index={index}
            total={total}
            progress={smoothProgress}
            isMobile={isMobile}
          />
        ))}

        {/* GLOBAL VIGNETTE */}
        <div className="absolute inset-0 pointer-events-none z-[60] bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)] opacity-80" />
      </div>
    </div>
  );
}

function ProgressBar({
  index,
  total,
  progress,
}: {
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  const scaleX = useTransform(progress, [index / total, (index + 1) / total], [0, 1]);
  return (
    /* Bar width reduced on mobile (w-5) vs desktop (w-8) to save horizontal space */
    <div className="h-1 w-5 md:w-8 bg-white/10 rounded-full overflow-hidden">
      <motion.div style={{ scaleX }} className="h-full bg-white origin-left" />
    </div>
  );
}

function Layer({
  data,
  index,
  total,
  progress,
  isMobile,
}: {
  data: (typeof STORY_LAYERS)[number];
  index: number;
  total: number;
  progress: MotionValue<number>;
  isMobile: boolean;
}) {
  const start = index / total;
  const end = (index + 2) / total;
  const exit = (index + 1) / total;

  const scale = useTransform(progress, [start, exit, end], [0.1, 1, 25]);
  const opacity = useTransform(
    progress,
    [start, start + 0.05, exit, exit + 0.05],
    [0, 1, 1, 0]
  );
  const blur = useTransform(progress, [exit, end], [0, 40]);
  const filter = useTransform(blur, (b) => `blur(${b}px)`);

  const textOpacity = useTransform(
    progress,
    [start + 0.02, start + 0.05, exit - 0.05, exit],
    [0, 1, 1, 0]
  );
  const textY = useTransform(progress, [start, exit], [20, -20]);

  return (
    <motion.div
      style={{ scale, opacity, filter }}
      className="absolute inset-0 flex items-center justify-center"
    >
      {/* Card: 80vw/80vh on mobile, 60vw/60vh on desktop — unchanged from original.
          Added px-6 md:px-12 on text container for better mobile padding. */}
      <div className="relative w-[80vw] h-[80vh] md:w-[60vw] md:h-[60vh] rounded-[2rem] overflow-hidden border border-white/20">
        <img
          src={isMobile && (data as { mobileImg?: string }).mobileImg
            ? (data as { mobileImg?: string }).mobileImg
            : data.img}
          className="w-full h-full object-cover grayscale-[0.2] hover:grayscale-0 transition-all duration-700"
          style={{
            objectPosition:
              (isMobile
                ? (data as { mobileObjectPosition?: string }).mobileObjectPosition
                : undefined) ??
              (data as { objectPosition?: string }).objectPosition ??
              "center",
          }}
          alt={data.title}
          loading={index < 2 ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={index < 2 ? "high" : "low"}
        />

        <motion.div
          style={{ opacity: textOpacity, y: textY }}
          className="absolute inset-0 flex flex-col items-center justify-center px-6 py-8 md:p-12 text-center"
        >
          <span
            className={`uppercase tracking-[0.3em] text-xs md:text-sm mb-3 md:mb-4 font-bold ${data.color}`}
          >
            Chapter 0{index + 1}
          </span>
          <h2 className="text-white text-4xl md:text-7xl font-black mb-3 md:mb-4 tracking-tighter uppercase italic [text-shadow:0_2px_20px_rgba(0,0,0,0.8)]">
            {data.title}
          </h2>
          {/* text-base on mobile (16px), text-lg on desktop (18px) — less line-wrapping */}
          <p className="text-white text-base md:text-lg max-w-xl font-normal leading-relaxed [text-shadow:0_2px_12px_rgba(0,0,0,0.9)]">
            {data.desc}
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
