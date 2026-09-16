import { GoogleGenAI } from "@google/genai";
import { isOwnStorageUrl, safeFetch } from "@/lib/net/safe-fetch";

const client = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
export const TEXT_MODEL = "gemini-3.5-flash";
export const EMBED_MODEL = "gemini-embedding-001";

export async function generateJson<T>(system: string, user: string, responseSchema: object, parse: (raw: unknown) => T): Promise<T> {
  const res = await client().models.generateContent({
    model: TEXT_MODEL,
    contents: user,
    config: { systemInstruction: system, responseMimeType: "application/json", responseSchema, temperature: 0.9 },
  });
  return parse(JSON.parse(res.text ?? "{}"));
}

export async function generateText(prompt: string): Promise<string> {
  const res = await client().models.generateContent({ model: TEXT_MODEL, contents: prompt });
  return res.text ?? "";
}

export async function embed(text: string): Promise<number[]> {
  const res = await client().models.embedContent({ model: EMBED_MODEL, contents: text, config: { outputDimensionality: 768 } });
  return res.embeddings![0].values!;
}

/** Media references must live in our own storage bucket (uploaded by the user); anything else is refused. */
export async function describeMedia(url: string): Promise<string> {
  if (!isOwnStorageUrl(url)) throw new Error("Media must be uploaded to Postpilot storage");
  const { bytes: buf, contentType } = await safeFetch(url, { maxBytes: 20 * 1024 * 1024 });
  const mime = contentType.split(";")[0] || (/\.(mp4|mov)(\?|$)/i.test(url) ? "video/mp4" : "image/jpeg");
  if (!/^(image|video)\//.test(mime)) throw new Error("Unsupported media type");
  const bytes = buf.toString("base64");
  const res = await client().models.generateContent({
    model: TEXT_MODEL,
    contents: [{ role: "user", parts: [{ inlineData: { mimeType: mime, data: bytes } }, { text: "Describe this for a social media copywriter in 2 sentences: subject, setting, mood, any text visible." }] }],
  });
  return res.text ?? "";
}

export async function summariseText(text: string): Promise<string> {
  const res = await client().models.generateContent({
    model: TEXT_MODEL,
    contents: `Summarise the key points of this page in 3 bullet points for a copywriter:\n\n${text.slice(0, 12000)}`,
  });
  return res.text ?? "";
}
