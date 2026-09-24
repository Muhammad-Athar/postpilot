"use client";
import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

export const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } };
export const rise: Variants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } };

export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }} className={className}>
      {children}
    </motion.div>
  );
}
export function Stagger({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <motion.div variants={stagger} initial="hidden" animate="show" className={className}>{children}</motion.div>;
}
export function Item({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <motion.div variants={rise} className={className}>{children}</motion.div>;
}
