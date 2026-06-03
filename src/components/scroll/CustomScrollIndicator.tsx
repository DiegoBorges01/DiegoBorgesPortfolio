import { useEffect, useRef } from "react";

/**
 * CustomScrollIndicator — arquivo único (CSS embutido)
 * ---------------------------------------------------------------------------
 * Indicador de scroll vertical, puramente visual, inspirado em estética
 * dark / futurista. Reflete o progresso da página com uma linha fina e um
 * marcador branco que se move suavemente.
 *
 *  - Nunca captura eventos (pointer-events: none) -> não interfere em cliques,
 *    links, hovers, GSAP, ScrollTrigger ou cursor fluido.
 *  - Não altera o scroll nativo, overflow ou a lógica das seções.
 *  - Movimento suavizado por interpolação linear dentro de um único
 *    requestAnimationFrame (usa refs, sem re-render do React por frame).
 *  - Oculto automaticamente em mobile / touch via media query.
 *
 * USO: importe e coloque UMA vez no layout principal:
 *
 *   import CustomScrollIndicator from "./CustomScrollIndicator";
 *   ...
 *   <CustomScrollIndicator />
 */

const STYLE_ID = "custom-scroll-indicator-styles";

const CSS = `
.custom-scroll-indicator {
  position: fixed;
  right: clamp(16px, 2vw, 32px);   /* lateral direita. Para CENTRALIZAR na tela: left: 50%; right: auto; */
  top: 50%;
  transform: translateY(-50%);
  height: clamp(160px, 32vh, 260px);
  width: 12px;
  z-index: 9999;
  pointer-events: none;
  display: none; /* só aparece no desktop (regra abaixo) */
}
.custom-scroll-track {
  position: relative;
  width: 2px;
  height: 100%;
  margin: 0 auto;            /* centraliza a linha dentro do container */
  /* degradê que some nas pontas -> combina com o fundo preto */
  background: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(98, 116, 150, 0.32) 18%,
    rgba(98, 116, 150, 0.32) 82%,
    transparent 100%
  );
  border-radius: 999px;
}
.custom-scroll-thumb {
  position: absolute;
  left: 50%;
  top: 0;
  width: 2px;
  height: clamp(28px, 5vh, 44px);
  transform: translate(-50%, 0);
  background: rgba(255, 255, 255, 0.95);
  border-radius: 999px;
  box-shadow:
    0 0 8px rgba(255, 255, 255, 0.35),
    0 0 18px rgba(90, 160, 255, 0.25);
  will-change: transform;
}
@media (hover: hover) and (pointer: fine) {
  .custom-scroll-indicator { display: block; }
}
`;

export default function CustomScrollIndicator() {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);

  const current = useRef(0); // progresso suavizado 0..1
  const target = useRef(0); // progresso bruto 0..1
  const rafId = useRef<number | null>(null);

  // Injeta o CSS uma única vez no <head>.
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!track || !thumb) return;

    const tick = () => {
      // interpolação linear -> movimento suave (sem pulo seco)
      current.current += (target.current - current.current) * 0.12;
      if (Math.abs(target.current - current.current) < 0.0001) {
        current.current = target.current;
      }

      const trackHeight = track.clientHeight;
      const thumbHeight = thumb.offsetHeight;
      const thumbY = current.current * (trackHeight - thumbHeight);
      thumb.style.transform = `translate(-50%, ${thumbY}px)`;

      if (Math.abs(target.current - current.current) > 0.0002) {
        rafId.current = requestAnimationFrame(tick);
      } else {
        rafId.current = null;
      }
    };

    const kick = () => {
      if (rafId.current == null) rafId.current = requestAnimationFrame(tick);
    };

    const readProgress = () => {
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      target.current =
        maxScroll > 0
          ? Math.min(1, Math.max(0, window.scrollY / maxScroll))
          : 0;
      kick();
    };

    window.addEventListener("scroll", readProgress, { passive: true });
    window.addEventListener("resize", readProgress);
    readProgress();

    return () => {
      window.removeEventListener("scroll", readProgress);
      window.removeEventListener("resize", readProgress);
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
      rafId.current = null;
    };
  }, []);

  return (
    <div className="custom-scroll-indicator" aria-hidden="true">
      <div className="custom-scroll-track" ref={trackRef}>
        <div className="custom-scroll-thumb" ref={thumbRef} />
      </div>
    </div>
  );
}
