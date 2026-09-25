/** Round avatar: image when available, otherwise initials on the accent tint. */
export function Avatar({ name, src, size = 32, className = "" }: { name: string; src?: string | null; size?: number; className?: string }) {
  const initials = name.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  return src ? (
    /* eslint-disable-next-line @next/next/no-img-element -- user-uploaded avatar */
    <img src={src} alt={name} style={style} className={`shrink-0 rounded-full object-cover ring-1 ring-line ${className}`} />
  ) : (
    <span style={style} className={`grid shrink-0 place-items-center rounded-full bg-accent-soft font-medium text-accent-strong ring-1 ring-line dark:text-accent ${className}`} aria-hidden>{initials}</span>
  );
}
