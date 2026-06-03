import { useEffect, useRef, useState } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

interface ScrambleTextProps {
  text: string;
  duration?: number;
  /** Token que muda para reexecutar o scramble (ex.: índice do slide). */
  trigger?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Scramble reveal — letras embaralhadas que se resolvem progressivamente.
 * Reexecuta sempre que `trigger` muda.
 */
export const ScrambleText = ({
  text,
  duration = 1.2,
  trigger,
  className,
  style,
}: ScrambleTextProps) => {
  const [display, setDisplay] = useState(text);
  const rafRef = useRef(0);

  useEffect(() => {
    const letters = text.split("");
    const totalMs = duration * 1000;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / totalMs, 1);
      const resolvedCount = Math.floor(progress * letters.length);

      setDisplay(
        letters
          .map((c, i) => {
            if (c === " ") return " ";
            if (i < resolvedCount) return c;
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          })
          .join("")
      );

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(text);
      }
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [text, duration, trigger]);

  return (
    <span className={className} style={style}>
      {display}
    </span>
  );
};