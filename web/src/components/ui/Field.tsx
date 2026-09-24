import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";

const control = "mt-1.5 w-full rounded-xl border border-line bg-elev px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-subtle transition-[border-color,box-shadow,background-color] duration-200 hover:border-line-strong focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 disabled:opacity-50";

export function Label({ children, hint, className = "" }: { children: ReactNode; hint?: string; className?: string }) {
  return (
    <span className={`block text-[13px] font-medium text-fg ${className}`}>
      {children}
      {hint && <span className="ml-1.5 font-normal text-fg-subtle">{hint}</span>}
    </span>
  );
}
export function Input({ className = "", ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${control} ${className}`} {...p} />;
}
export function Textarea({ className = "", ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${control} resize-y ${className}`} {...p} />;
}
export function Select({ className = "", children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${control} cursor-pointer ${className}`} {...p}>{children}</select>;
}
export function Field({ label, hint, children }: { label: ReactNode; hint?: string; children: ReactNode }) {
  return <label className="block"><Label hint={hint}>{label}</Label>{children}</label>;
}
