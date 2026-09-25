/** Sends through the n8n notify workflow (the SMTP credential lives there). Returns false, without throwing, when notify isn't configured or reachable. */
export async function sendEmail(m: { to: string; subject: string; html: string }): Promise<boolean> {
  const base = process.env.N8N_BASE_URL, path = process.env.N8N_NOTIFY_WEBHOOK_PATH;
  if (!base || !path || !process.env.APP_SECRET) return false;
  try {
    const r = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-postpilot-secret": process.env.APP_SECRET }, body: JSON.stringify(m), signal: AbortSignal.timeout(8000) });
    return r.ok;
  } catch { return false; }
}
