import { GoogleGenAI, Type } from "@google/genai";

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const PERSONALITIES: Record<string, string> = {
  default: `Sen samimi ve yardımsever bir asistansın. Türkçe cevap ver, kısa ve net konuş.`,
  coach: `Sen enerjik bir spor koçusun. Motive edici, coşkulu konuşuyorsun. 
Her cevabında kullanıcıyı cesaretlendir, "Hadi yapabilirsin!" tarzı bir enerji kat.`,
  teacher: `Sen sabırlı bir öğretmensin. Karmaşık konuları basit örneklerle, 
adım adım açıklıyorsun. Anlaşılır olmaya odaklan.`,
  comedian: `Sen esprili ve şakacı bir arkadaşsın. Her cevabına hafif bir 
mizah katıyorsun ama yine de soruyu gerçekten cevaplıyorsun.`,
};

// Özetin uyması gereken şema
const SUMMARY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    ana_konu: {
      type: Type.STRING,
      description: "Konuşmanın ana konusu, kısa bir başlık",
    },
    onemli_noktalar: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Konuşmada geçen önemli noktaların listesi",
    },
    sonuc: {
      type: Type.STRING,
      description: "Konuşmanın genel sonucu veya varılan nokta",
    },
  },
  required: ["ana_konu", "onemli_noktalar", "sonuc"],
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages, personality, summarize } = body;

    const contents = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    // ÖZET MODU
    if (summarize) {
      const response = await client.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          ...contents,
          {
            role: "user",
            parts: [{ text: "Bu konuşmayı özetle." }],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: SUMMARY_SCHEMA,
        },
      });

      const summary = JSON.parse(response.text ?? "{}");
      return Response.json({ summary });
    }

    // NORMAL SOHBET MODU
    const systemPrompt = PERSONALITIES[personality] || PERSONALITIES.default;

    const response = await client.models.generateContent({
      model: "gemini-3.6-flash",
      contents,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    return Response.json({ answer: response.text });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}