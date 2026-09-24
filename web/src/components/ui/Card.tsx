"use client";
import { motion, type HTMLMotionProps } from "framer-motion";

export function Card({ className = "", lift = false, children, ...rest }: HTMLMotionProps<"div"> & { lift?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={lift ? { y: -2, boxShadow: "var(--shadow-lift)" } : undefined}
      className={`rounded-[var(--radius)] border border-line bg-elev shadow-card ${className}`}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
