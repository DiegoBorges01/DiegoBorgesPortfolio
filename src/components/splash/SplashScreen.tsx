import { lazy, Suspense, useEffect } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { TopNav } from "./TopNav";
import { Headline } from "./Headline";
import cardFrontImg from "@/assets/lanyard/card-front.webp";
import { useLoaderStarted } from "@/providers/LoaderGate";

// Retry dynamic import once on transient network/HMR failure to avoid
// "Failed to fetch dynamically imported module" blank-screen errors.
// Retry the dynamic import a few times; if it still fails (typically because
// the deployed chunk hash changed after a new build), force a one-time reload
// so the browser fetches the fresh asset manifest instead of showing a blank
// screen.
const importLanyard = (retries = 2): Promise<typeof import("@/components/lanyard/Lanyard")> =>
  import("@/components/lanyard/Lanyard").catch((err) => {
    if (retries > 0) {
      return new Promise((resolve) => setTimeout(resolve, 400)).then(() =>
        importLanyard(retries - 1),
      );
    }
    if (typeof window !== "undefined") {
      const key = "lanyard-chunk-reloaded";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        // Return a never-resolving promise while the page reloads.
        return new Promise(() => {}) as never;
      }
    }
    throw err;
  });

// O módulo do Lanyard (Three.js + .glb, ~5 MB) NÃO é baixado no carregamento
// do módulo. Ele é aquecido só depois da primeira pintura (ver useEffect
// abaixo) ou quando o <Lanyard> monta de fato, pra não pesar no caminho crítico.
let lanyardModulePromise: ReturnType<typeof importLanyard> | null = null;
const loadLanyard = () => (lanyardModulePromise ??= importLanyard());
const Lanyard = lazy(loadLanyard);

function LanyardFallback() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden>
      <img
        src={cardFrontImg}
        alt=""
        draggable={false}
        className="absolute right-[7vw] top-[51%] w-[192px] -translate-y-1/2 select-none rounded-[10px] md:right-[7vw] md:w-[194px]"
      />
    </div>
  );
}

interface SplashScreenProps {
  scrollYProgress: MotionValue<number>;
}

export const SplashScreen = ({ scrollYProgress }: SplashScreenProps) => {
  // Indicador "scroll" some assim que o usuário começa a rolar a página.
  const { scrollY } = useScroll();
  const scrollTextOpacity = useTransform(scrollY, [0, 80], [0.5, 0]);
  const scrollTextY = useTransform(scrollY, [0, 80], [0, 12]);
  const started = useLoaderStarted();

  // Aquece o módulo 3D depois que a tela já pintou, deixando-o pronto antes de
  // o crachá montar, sem competir com os recursos do carregamento inicial.
  useEffect(() => {
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback;
    let idleId: number | undefined;
    let timerId: number | undefined;
    if (ric) {
      idleId = ric(() => void loadLanyard(), { timeout: 1500 });
    } else {
      timerId = window.setTimeout(() => void loadLanyard(), 600);
    }
    return () => {
      const cic = (window as unknown as {
        cancelIdleCallback?: (id: number) => void;
      }).cancelIdleCallback;
      if (idleId !== undefined && cic) cic(idleId);
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, []);

  return (
    <section
      className="relative z-10 w-full bg-background text-foreground"
      style={{ height: "100vh" }}
    >
      <div className="relative h-full w-full overflow-hidden">
        <TopNav />

        {/* Headline centralizado na Splash */}
        <div className="relative z-10 flex h-full w-full items-center justify-center px-6">
          <Headline />
        </div>

        {/* 3D Lanyard badge — só monta após o loader sair pra não desperdiçar a animação de queda */}
        {started ? (
          <Suspense fallback={<LanyardFallback />}>
            <Lanyard position={[0, 0, 18]} gravity={[0, -90, 0]} />
          </Suspense>
        ) : (
          <LanyardFallback />
        )}

        {/* Scroll hint — minimalista, desaparece ao começar a rolar */}
        <motion.div
          style={{ opacity: scrollTextOpacity, y: scrollTextY }}
          className="pointer-events-none absolute inset-x-0 bottom-[72px] md:bottom-[76px] z-30 flex flex-col items-center gap-1.5"
        >
          <motion.span
            animate={{ y: [0, 4, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="font-mono-display text-[9px] md:text-[10px] uppercase tracking-[0.25em] text-white/80"
          >
            scroll
          </motion.span>
          <motion.svg
            animate={{ y: [0, 4, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
            width="10"
            height="6"
            viewBox="0 0 10 6"
            fill="none"
            className="text-white/80"
            aria-hidden="true"
          >
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
        </motion.div>
      </div>
    </section>
  );
};