import { memo, useEffect, useMemo, useRef, useState } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";

interface GeometricStaggeredLinesProps {
  scrollYProgress: MotionValue<number>;
  mode?: "connector";
}

const LINES_COUNT = 20;
// Fração do scroll reservada para a "vida" de cada linha (entrada → pico → saída).
// Mantém-se constante para todas as linhas — assim a última também completa o ciclo.
const LINE_LIFESPAN = 0.34;

// Cache global por viewportWidth — evita recálculo entre re-renders e instâncias.
type LineGeometry = {
  width: number;
  keyframes: [number, number, number, number];
};
const geometryCache = new Map<number, LineGeometry[]>();

const computeGeometry = (viewportWidth: number): LineGeometry[] => {
  const cached = geometryCache.get(viewportWidth);
  if (cached) return cached;

  const widestLine = Math.min(viewportWidth * 0.64, 1060);
  const pointLine = Math.max(6, Math.min(viewportWidth * 0.012, 18));
  const startMax = 1 - LINE_LIFESPAN;

  const result: LineGeometry[] = Array.from({ length: LINES_COUNT }, (_, index) => {
    const progress = index / Math.max(LINES_COUNT - 1, 1);
    const funnelWidth =
      pointLine + (widestLine - pointLine) * Math.pow(1 - progress, 1.62);
    const start = progress * startMax;
    const peakIn = start + LINE_LIFESPAN * 0.32;
    const peakOut = start + LINE_LIFESPAN * 0.62;
    const end = start + LINE_LIFESPAN;
    return {
      width: funnelWidth,
      keyframes: [start, peakIn, peakOut, end],
    };
  });

  geometryCache.set(viewportWidth, result);
  return result;
};

interface LineProps {
  index: number;
  scrollYProgress: MotionValue<number>;
  geometry: LineGeometry;
}

const OPACITY_RANGE = [0, 0.85, 0.85, 0] as const;

const Line = memo(({ scrollYProgress, geometry }: LineProps) => {
  // Mantém a referência dos keyframes estável entre renders para que o
  // motion value não seja recriado quando o pai re-renderiza.
  const keyframesRef = useRef(geometry.keyframes);
  keyframesRef.current = geometry.keyframes;

  const opacity = useTransform(
    scrollYProgress,
    geometry.keyframes,
    OPACITY_RANGE as unknown as number[],
  );

  return (
    <motion.div
      style={{ width: geometry.width, opacity }}
      className="h-px rounded-full bg-foreground/80 shadow-[0_0_12px_hsl(var(--foreground)/0.18)] will-change-[opacity]"
      aria-hidden
    />
  );
});
Line.displayName = "FunnelLine";

/**
 * Conector único entre Splash e Hero.
 * Fica fixo no centro da transição, aparece só após o início do scroll
 * e some de cima para baixo para formar um funil invertido contínuo.
 */
export const GeometricStaggeredLines = ({
  scrollYProgress,
  mode = "connector",
}: GeometricStaggeredLinesProps) => {
  const [viewportWidth, setViewportWidth] = useState(1440);
  // Movimento contínuo: o conjunto desliza suavemente de baixo para cima
  // enquanto o usuário rola a bridge — assim cada linha do fim da Splash
  // é a mesma linha que continua aparecendo no início da Hero.
  const y = useTransform(scrollYProgress, [0, 1], [80, -80]);

  useEffect(() => {
    let frame = 0;
    const updateViewportWidth = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setViewportWidth((prev) =>
          prev === window.innerWidth ? prev : window.innerWidth,
        );
      });
    };
    updateViewportWidth();
    window.addEventListener("resize", updateViewportWidth, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateViewportWidth);
    };
  }, []);

  // Geometria por linha — cacheada por viewport, compartilhada entre instâncias.
  const geometries = useMemo(() => computeGeometry(viewportWidth), [viewportWidth]);

  return (
    <motion.div
      data-mode={mode}
      style={{ y }}
      className="pointer-events-none absolute inset-x-0 top-0 z-[60] flex h-full w-full flex-col items-center justify-center gap-[clamp(34px,4.5vh,46px)] px-6"
    >
      {geometries.map((geometry, index) => (
        <Line
          key={`connector-${index}`}
          index={index}
          scrollYProgress={scrollYProgress}
          geometry={geometry}
        />
      ))}
    </motion.div>
  );
};