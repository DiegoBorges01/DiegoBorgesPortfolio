import { motion } from "framer-motion";
import { Logo } from "./Logo";
import { useLoaderStarted } from "@/providers/LoaderGate";

const items = [
  { label: "Trabalhos", href: "#trabalhos" },
  { label: "Currículo", href: "#curriculo" },
  { label: "Contato", href: "#contato" },
];

export const TopNav = () => {
  const started = useLoaderStarted();
  return (
    <header className="absolute inset-x-0 top-0 z-20 px-4 py-5 md:px-12 md:py-8">
      <nav
        aria-label="Navegação principal"
        className="mx-auto flex w-full max-w-[1600px] items-center gap-4 md:gap-6"
      >
        <Logo initials="DG" />

        {/* Animated horizontal line — desktop only */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={started ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{ duration: 1.5, delay: started ? 0.5 : 0, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: "left center" }}
          className="hidden h-px flex-1 bg-foreground/30 md:block"
        />






        <ul className="ml-auto flex items-center gap-4 text-[11px] sm:gap-6 sm:text-xs md:gap-12 md:text-[15px]">
          {items.map((item, i) => (
            <motion.li
              key={item.href}
              initial={{ opacity: 0, y: -8 }}
              animate={started ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.8, delay: started ? 0.2 + i * 0.14 : 0, ease: "easeOut" }}
            >
              <a
                href={item.href}
                className="group relative inline-block text-foreground/85 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
              >
                {item.label}
                <span className="absolute -bottom-1 left-0 h-px w-full origin-right scale-x-0 bg-foreground transition-transform duration-300 ease-out group-hover:origin-left group-hover:scale-x-100" />
              </a>
            </motion.li>
          ))}
        </ul>
      </nav>
    </header>
  );
};
