/** Fire an n8n webhook with the shared secret. Throws on non-2xx. */
export async function triggerWorkflow(path: string, payload: unknown): Promise<void> {
  const res = await fetch(`${process.env.N8N_BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-postpilot-secret": process.env.APP_SECRET! },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`n8n ${path} responded ${res.status}`);
}
