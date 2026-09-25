import { GoogleGenAI } from "@google/genai";
import { isOwnStorageUrl, safeFetch } from "@/lib/net/safe-fetch";

const client = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
export const TEXT_MODEL = "gemini-3.5-flash";
/** Free-tier quotas are per model, so overloaded/exhausted models fall through to lighter ones. */
export const MODEL_CHAIN = [TEXT_MODEL, "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"];
export const EMBED_MODEL = "gemini-embedding-001";

const isTransient = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  return /\b(429|503|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded|rate limit)\b/i.test(m);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Tries each model in the chain; retries transient errors twice per model with short backoff. */
export async function withModelFallback<T>(fn: (model: string) => Promise<T>): Promise<T> {
  let last: unknown;
  for (const model of MODEL_CHAIN) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try { return await fn(model); }
      catch (e) {
        last = e;
        if (!isTransient(e)) throw e;
        if (attempt === 0) await sleep(1500);
      }
    }
  }
  throw new Error(`The model is busy right now. Please try again in a minute. (${last instanceof Error ? last.message.slice(0, 120) : "unknown"})`);
}

export async function generateJson<T>(system: string, user: string, responseSchema: object, parse: (raw: unknown) => T): Promise<T> {
  return withModelFallback(async (model) => {
    const res = await client().models.generateContent({
      model, contents: user,
      config: { systemInstruction: system, responseMimeType: "application/json", responseSchema, temperature: 0.9 },
    });
    return parse(JSON.parse(res.text ?? "{}"));
  });
}

export async function generateText(prompt: string): Promise<string> {
  return withModelFallback(async (model) => (await client().models.generateContent({ model, contents: prompt })).text ?? "");
}

export async function embed(text: string): Promise<number[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await client().models.embedContent({ model: EMBED_MODEL, contents: text, config: { outputDimensionality: 768 } });
      return res.embeddings![0].values!;
    } catch (e) { if (attempt === 1 || !isTransient(e)) throw e; await sleep(1200); }
  }
  throw new Error("unreachable");
}

/** Media references must live in our own storage bucket (uploaded by the user); anything else is refused. */
export async function describeMedia(url: string): Promise<string> {
  if (!isOwnStorageUrl(url)) throw new Error("Media must be uploaded to Postpilot storage");
  const { bytes: buf, contentType, status } = await safeFetch(url, { maxBytes: 20 * 1024 * 1024 });
  if (status >= 400) throw new Error(`Media fetch failed with ${status}`);
  const mime = contentType.split(";")[0] || (/\.(mp4|mov)(\?|$)/i.test(url) ? "video/mp4" : "image/jpeg");
  if (!/^(image|video)\//.test(mime)) throw new Error("Unsupported media type");
  const bytes = buf.toString("base64");
  return withModelFallback(async (model) => {
    const res = await client().models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: mime, data: bytes } }, { text: "Describe this for a social media copywriter in 2 sentences: subject, setting, mood, any text visible." }] }],
    });
    return res.text ?? "";
  });
}

export async function summariseText(text: string): Promise<string> {
  return withModelFallback(async (model) => {
    const res = await client().models.generateContent({ model, contents: `Summarise the key points of this page in 3 bullet points for a copywriter:\n\n${text.slice(0, 12000)}` });
    return res.text ?? "";
  });
}
