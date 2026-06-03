import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type LenisProviderProps = {
  children: ReactNode;
};

/**
 * Integra Lenis com ScrollTrigger.
 *
 * Lenis em modo "window" rola o documento de verdade (scrollY nativo),
 * então NÃO precisamos de scrollerProxy — basta:
 *  1. Disparar ScrollTrigger.update a cada frame do Lenis.
 *  2. Rodar Lenis pelo ticker do GSAP.
 *
 * Assim qualquer ScrollTrigger usa o scroller default (window) e fica
 * sincronizado naturalmente com o smooth scroll.
 */
export const LenisProvider = ({ children }: LenisProviderProps) => {
  useEffect(() => {
    const lenis = new Lenis({
      autoRaf: false,
      smoothWheel: true,
      anchors: true,
    });

    // Expor instância globalmente para que seções específicas
    // (ex.: slider WebGL) possam pausar/retomar o scroll global.
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;

    lenis.on("scroll", ScrollTrigger.update);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    const refreshId = window.setTimeout(() => ScrollTrigger.refresh(), 250);
    const onResize = () => ScrollTrigger.refresh();
    window.addEventListener("resize", onResize);

    return () => {
      window.clearTimeout(refreshId);
      window.removeEventListener("resize", onResize);
      gsap.ticker.remove(raf);
      lenis.off("scroll", ScrollTrigger.update);
      lenis.destroy();
      if ((window as unknown as { __lenis?: Lenis }).__lenis === lenis) {
        delete (window as unknown as { __lenis?: Lenis }).__lenis;
      }
    };
  }, []);

  return <>{children}</>;
};
