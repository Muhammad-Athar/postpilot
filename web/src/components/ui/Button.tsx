"use client";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { motion } from "framer-motion";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";
export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd"> {
  variant?: Variant; size?: Size; loading?: boolean; block?: boolean;
}
const base = "relative inline-flex select-none items-center justify-center gap-2 rounded-xl font-medium tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-50 disabled:cursor-not-allowed";
const variants: Record<Variant, string> = {
  primary: "bg-fg text-bg hover:bg-fg/90 shadow-card",
  accent: "bg-accent text-accent-fg hover:bg-accent-strong shadow-card",
  secondary: "border border-line-strong bg-elev text-fg hover:bg-muted hover:border-fg/30",
  ghost: "text-fg-muted hover:text-fg hover:bg-muted",
  danger: "bg-danger-soft text-danger hover:bg-danger hover:text-white",
};
const sizes: Record<Size, string> = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-base" };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "primary", size = "md", loading, block, className = "", children, disabled, ...rest }, ref) {
  return (
    <motion.button
      ref={ref}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      whileHover={disabled || loading ? undefined : { y: -1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`${base} ${variants[variant]} ${sizes[size]} ${block ? "w-full" : ""} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </motion.button>
  );
});
