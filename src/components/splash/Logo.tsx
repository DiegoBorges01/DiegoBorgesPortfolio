import { motion } from "framer-motion";

interface LogoProps {
  initials?: string;
}

/**
 * Capsule-shaped logo with thin white outline and the user's initials inside.
 * Inspired by the reference image. Initials default to "JS" until confirmed.
 */
export const Logo = ({ initials = "DG" }: LogoProps) => {
  return (
    <motion.a
      href="#"
      aria-label="Início"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.05 }}
      className="group inline-flex items-center justify-center"
    >
      <svg
        width="72"
        height="44"
        viewBox="0 0 72 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
        aria-hidden="true"
      >
        <rect
          x="1"
          y="1"
          width="70"
          height="42"
          rx="21"
          stroke="hsl(var(--foreground))"
          strokeWidth="1.5"
          className="transition-all duration-300 group-hover:[filter:drop-shadow(0_0_6px_hsl(var(--foreground)/0.6))]"
        />
        <text
          x="36"
          y="28"
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
          fontSize="14"
          fontWeight="700"
          letterSpacing="2"
          fill="hsl(var(--foreground))"
        >
          {initials}
        </text>
      </svg>
    </motion.a>
  );
};