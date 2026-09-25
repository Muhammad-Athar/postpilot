export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateProfileInput(i: { displayName: string; email: string }): Validation<{ displayName: string; email: string }> {
  const displayName = i.displayName.trim(); const email = i.email.trim().toLowerCase();
  if (displayName.length < 2 || displayName.length > 60) return { ok: false, error: "Name must be 2–60 characters." };
  if (!EMAIL.test(email) || email.length > 254) return { ok: false, error: "Enter a valid email address." };
  return { ok: true, value: { displayName, email } };
}

export function validatePasswordInput(i: { current: string; next: string; confirm: string }): Validation<{ current: string; next: string }> {
  if (!i.current) return { ok: false, error: "Enter your current password." };
  if (i.next.length < 8 || i.next.length > 72) return { ok: false, error: "New password must be 8–72 characters." };
  if (i.next !== i.confirm) return { ok: false, error: "New passwords do not match." };
  if (i.next === i.current) return { ok: false, error: "New password must differ from the current one." };
  return { ok: true, value: { current: i.current, next: i.next } };
}
