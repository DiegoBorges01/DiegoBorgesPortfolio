import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedGradientWordProps {
  words?: string[];
  interval?: number;
  className?: string;
}

/**
 * Cicla entre palavras com gradientes vibrantes e animados.
 * Cada palavra tem seu próprio gradiente que continua fluindo enquanto exibida.
 */
export const AnimatedGradientWord = ({
  words = ["dev", "criador", "designer", "builder"],
  interval = 3600,
  className,
}: AnimatedGradientWordProps) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const firstSwap = window.setTimeout(() => {
      setIndex((i) => (i + 1) % words.length);
    }, 2800);
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % words.length);
    }, interval);
    return () => {
      window.clearTimeout(firstSwap);
      window.clearInterval(id);
    };
  }, [words.length, interval]);

  const current = words[index];

  return (
    <span
      className={cn(
        "relative inline-flex items-baseline align-baseline overflow-hidden py-[0.28em] -my-[0.28em] leading-none",
        className
      )}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={current}
          initial={{ y: "100%", opacity: 0, filter: "blur(8px)" }}
          animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
          exit={{ y: "-100%", opacity: 0, filter: "blur(8px)" }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex"
        >
          {current.split("").map((letter, i) => (
            <motion.span
              key={`${current}-${i}`}
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: "0%", opacity: 1 }}
              transition={{
                duration: 0.75,
                delay: i * 0.06,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="text-gradient-creative inline-block"
            >
              {letter === " " ? "\u00A0" : letter}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};