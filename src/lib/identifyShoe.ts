import { jsonError } from "@/lib/apiResponse";

/** Prefer lighter free-tier models first to reduce 429s. */
const GEMINI_MODELS = [
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
] as const;

type IdentifyResult = {
  name: string;
  confidence: "high" | "medium" | "low";
  notes?: string;
};

function getApiKey(): string | null {
  return process.env.GEMINI_API_KEY?.trim() || null;
}

export function isShoeIdentifyConfigured(): boolean {
  return Boolean(getApiKey());
}

function extractJsonObject(text: string): IdentifyResult | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as Partial<IdentifyResult>;
    const name = String(parsed.name ?? "").trim();
    if (!name) return null;
    const confidence =
      parsed.confidence === "high" ||
      parsed.confidence === "medium" ||
      parsed.confidence === "low"
        ? parsed.confidence
        : "medium";
    return {
      name,
      confidence,
      notes: parsed.notes ? String(parsed.notes).trim() : undefined,
    };
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function friendlyGeminiError(status: number, message: string): string {
  if (
    status === 429 ||
    /resource.?exhausted|rate.?limit|quota|too many requests/i.test(message)
  ) {
    return "Gemini free tier is rate-limited right now. Wait about a minute and try Identify again.";
  }
  if (status === 403 || /api key|permission|blocked/i.test(message)) {
    return "Gemini rejected the API key. Check GEMINI_API_KEY in Vercel or create a new key in Google AI Studio.";
  }
  return message || "Could not identify shoe.";
}

export async function identifyShoeFromImage(input: {
  base64: string;
  mimeType: string;
}): Promise<IdentifyResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw Object.assign(new Error("Shoe identify is not configured."), {
      status: 503,
    });
  }

  const mimeType = input.mimeType || "image/jpeg";
  const base64 = input.base64.replace(/^data:[^;]+;base64,/, "");

  const prompt = `You identify sneakers and shoes from a photo for a reseller inventory app.
Return ONLY valid JSON (no markdown) with this shape:
{"name":"Brand Model Colorway","confidence":"high"|"medium"|"low","notes":"optional short note"}
Rules:
- name should look like listing titles (e.g. "Nike Dunk Low Michigan" or "Jordan 1 Retro High OG Chicago")
- If unsure, still guess the closest popular name and set confidence to low
- If it is not footwear, set name to "" and confidence to low
- Do not invent SKUs or prices`;

  let lastError = "Could not identify shoe.";
  let lastStatus = 502;

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 256,
          },
        }),
      });

      const data = (await res.json()) as {
        error?: { message?: string; status?: string };
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };

      if (!res.ok) {
        lastStatus = res.status;
        lastError = data.error?.message || lastError;

        if (res.status === 404 || /not found|not supported/i.test(lastError)) {
          break; // next model
        }

        if (
          (res.status === 429 ||
            /resource.?exhausted|rate.?limit|quota/i.test(lastError)) &&
          attempt === 0
        ) {
          await sleep(1500);
          continue; // retry same model once
        }

        if (
          res.status === 429 ||
          /resource.?exhausted|rate.?limit|quota/i.test(lastError)
        ) {
          // Try next lighter/heavier model instead of failing immediately.
          break;
        }

        throw Object.assign(new Error(friendlyGeminiError(res.status, lastError)), {
          status: res.status >= 400 && res.status < 600 ? res.status : 502,
        });
      }

      const text =
        data.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? "")
          .join("\n")
          .trim() ?? "";

      const parsed = extractJsonObject(text);
      if (!parsed?.name) {
        throw Object.assign(
          new Error(
            "Could not recognize a shoe in that photo. Try a clearer side shot.",
          ),
          { status: 422 },
        );
      }

      return parsed;
    }
  }

  throw Object.assign(new Error(friendlyGeminiError(lastStatus, lastError)), {
    status: lastStatus === 429 ? 429 : 502,
  });
}

export function identifyConfigErrorResponse() {
  return jsonError(
    "Add GEMINI_API_KEY on Vercel (free from Google AI Studio), then redeploy.",
    503,
  );
}
