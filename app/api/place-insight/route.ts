import { NextResponse } from "next/server";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

type InsightBody = {
  name?: string;
  prefecture?: string;
  categories?: string[];
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

// Server-side proxy to Gemini. The API key is a real secret and never leaves
// the server; the client only calls this route.
export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI is not configured." }, { status: 503 });
  }

  let body: InsightBody;
  try {
    body = (await request.json()) as InsightBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Missing place name." }, { status: 400 });
  }
  const prefecture = (body.prefecture ?? "").trim();
  const categories = Array.isArray(body.categories)
    ? body.categories.join("、")
    : "";

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const prompt = `あなたは日本の旅の精「タビ」です。次の場所について、旅行者向けに親しみやすい日本語で2〜3文（120〜180文字程度）で紹介してください。見どころ・おすすめの過ごし方・季節やひとことアドバイスを含め、誇張や不確かな事実は避けてください。マークダウンや箇条書きは使わず、文章で書いてください。\n場所: ${name}${prefecture ? `（${prefecture}）` : ""}${categories ? `\nジャンル: ${categories}` : ""}`;

  try {
    const response = await fetch(
      `${ENDPOINT}/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
        }),
      },
    );

    if (!response.ok) {
      return NextResponse.json({ error: "AI request failed." }, { status: 502 });
    }

    const data = (await response.json()) as GeminiResponse;
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!text) {
      return NextResponse.json({ error: "Empty AI response." }, { status: 502 });
    }

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: "AI request error." }, { status: 502 });
  }
}
