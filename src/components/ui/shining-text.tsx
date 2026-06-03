"use client";

import { motion, type MotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface ShiningTextProps extends Omit<MotionProps, "children"> {
  children: React.ReactNode;
  className?: string;
  duration?: number;
  as?: "span" | "h1" | "h2" | "div";
}

/**
 * ShiningText — radiant gradient sweep using framer-motion.
 * (No new dep; reuses framer-motion already in the project.)
 */
export function ShiningText({
  children,
  className,
  duration = 2.4,
  as = "span",
  ...rest
}: ShiningTextProps) {
  const Comp = motion[as] as typeof motion.span;
  return (
    <Comp
      className={cn(
        "bg-[linear-gradient(110deg,#404040,35%,#ffffff,50%,#404040,75%,#404040)] bg-clip-text text-transparent",
        className,
      )}
      style={{ backgroundSize: "200% 100%" }}
      initial={{ backgroundPosition: "200% 0" }}
      animate={{ backgroundPosition: "-200% 0" }}
      transition={{ repeat: Infinity, duration, ease: "linear" }}
      {...rest}
    >
      {children}
    </Comp>
  );
}
