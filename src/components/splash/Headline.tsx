import { motion } from "framer-motion";
import { AnimatedGradientWord } from "./AnimatedGradientWord";
import { useLoaderStarted } from "@/providers/LoaderGate";

const line1 = ["Conheça", "seu", "próximo"];

export const Headline = () => {
  const started = useLoaderStarted();
  const hidden = { opacity: 0, y: 24 };
  const shown = { opacity: 1, y: 0 };
  return (
    <h1
      className="text-center font-extrabold leading-[0.95] text-foreground"
      style={{
        fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
        letterSpacing: "-0.04em",
        fontSize: "clamp(40px, 6vw, 84px)",
      }}
    >
      <span className="block">
        {line1.map((word, i) => (
          <motion.span
            key={word}
            initial={hidden}
            animate={started ? shown : hidden}
            transition={{
              duration: 1.3,
              delay: started ? 0.2 + i * 0.18 : 0,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="mr-[0.25em] inline-block"
          >
            {word}
          </motion.span>
        ))}
      </span>

      <span className="mt-2 block">
        <motion.span
          initial={hidden}
          animate={started ? shown : hidden}
          transition={{ duration: 1.3, delay: started ? 0.9 : 0, ease: [0.22, 1, 0.36, 1] }}
          className="mr-[0.25em] inline-block"
        >
          <AnimatedGradientWord
            words={["dev", "criador", "designer", "builder"]}
            interval={2600}
          />
        </motion.span>
        <motion.span
          initial={hidden}
          animate={started ? shown : hidden}
          transition={{ duration: 1.3, delay: started ? 1.05 : 0, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block"
        >
          criativo.
        </motion.span>
      </span>
    </h1>
  );
};