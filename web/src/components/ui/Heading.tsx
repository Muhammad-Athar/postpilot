import type { ReactNode } from "react";
export function Display({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h1 className={`font-serif text-4xl leading-[1.05] tracking-[-0.01em] text-fg sm:text-5xl ${className}`}>{children}</h1>;
}
/** The page name lives in the top bar; this renders only the lead sentence (title kept for accessibility). */
export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="sr-only">{children}</h1>
      {sub && <p className="max-w-3xl text-[15px] text-fg-muted">{sub}</p>}
    </div>
  );
}
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-accent">{children}</p>;
}
