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

// --- EMBEDDINGS ÖRNEĞİ: Basit bir bilgi bankası ---

const KNOWLEDGE_BASE = [
  "Gizem full-stack developer olarak çalışıyor ve AI Engineering alanına geçiş yapıyor.",
  "Bu chatbot Next.js ve Google Gemini API kullanılarak geliştirildi.",
  "Proje GitHub'da açık kaynak olarak paylaşılıyor.",
  "Chatbot; kişilik modu, konuşma özeti ve hava durumu sorgulama özelliklerine sahip.",
  "Öğrenme yol haritası LLM Fundamentals'tan başlayıp Production AI'a kadar gidiyor.",
];

// Bir metnin embedding'ini (sayı listesini) çıkarıyoruz
async function getEmbedding(text: string): Promise<number[]> {
  const result = await client.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
  });
  return result.embeddings?.[0]?.values ?? [];
}

// İki embedding arasındaki "yakınlığı" ölçüyoruz (cosine similarity)
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

// Bilgi bankasının embedding'lerini bir kere hesaplayıp bellekte tutuyoruz
let knowledgeEmbeddings: number[][] | null = null;

async function getKnowledgeEmbeddings(): Promise<number[][]> {
  if (knowledgeEmbeddings) return knowledgeEmbeddings;
  knowledgeEmbeddings = await Promise.all(
    KNOWLEDGE_BASE.map((text) => getEmbedding(text))
  );
  return knowledgeEmbeddings;
}

// Soruya en yakın bilgileri buluyoruz (artık birden fazla)
async function findRelevantKnowledge(question: string, topN: number = 2): Promise<string[]> {
  const questionEmbedding = await getEmbedding(question);
  const kbEmbeddings = await getKnowledgeEmbeddings();

  const scored = kbEmbeddings.map((embedding, i) => ({
    text: KNOWLEDGE_BASE[i],
    score: cosineSimilarity(questionEmbedding, embedding),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topN).map((item) => item.text);
}

// Gerçek hava durumu verisi çeken fonksiyon
async function getWeather(city: string) {
  // Önce şehrin koordinatlarını buluyoruz
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=tr`
  );
  const geoData = await geoRes.json();

  if (!geoData.results || geoData.results.length === 0) {
    return { error: "Şehir bulunamadı" };
  }

  const { latitude, longitude, name } = geoData.results[0];

  // Sonra o koordinatların hava durumunu çekiyoruz
  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`
  );
  const weatherData = await weatherRes.json();

  return {
    city: name,
    temperature: weatherData.current.temperature_2m,
    unit: "°C",
  };
}

  // Modelin bilmesi gereken "araç" tanımı
const WEATHER_TOOL = {
    functionDeclarations: [
      {
        name: "get_weather",
        description: "Belirtilen şehir için güncel hava durumu bilgisini döndürür",
        parameters: {
          type: Type.OBJECT,
          properties: {
            city: {
              type: Type.STRING,
              description: "Hava durumu sorulacak şehir adı, örn: İstanbul",
            },
          },
          required: ["city"],
        },
      },
    ],
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
    const { messages, personality, summarize, askKnowledge } = body;

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

        // BİLGİ BANKASI MODU (embedding örneği)
    if (askKnowledge) {
      const lastMessage = messages[messages.length - 1]?.content ?? "";
      const relevantFacts = await findRelevantKnowledge(lastMessage);

      const response = await client.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                 text: `Sen bir bilgi asistanısın. Kendi kimliğin, eğitimin veya yapımın hakkında ASLA konuşma. Sen bir yapay zeka değilsin, sen bu projenin bilgi bankasını okuyan bir sistemsin.

                Kullanıcı sana "kendini" veya "seni" diye sorsa bile, bunu HER ZAMAN "bu chatbot uygulaması" olarak yorumla — yani "sen" derken hep bu projeyi kastet, Gemini modelini veya kendi mimarini değil.

                SADECE aşağıdaki bilgi bankasını kullan, başka hiçbir bilgi ekleme:

                ${relevantFacts.map((f, i) => `${i + 1}. ${f}`).join("\n")}

                Soru: ${lastMessage}

                Cevabını SADECE yukarıdaki bilgi bankasına dayandır.`,
              },
            ],
          },
        ],
      });

      return Response.json({ answer: response.text, usedFact: relevantFacts.join(" | ") });
    }

    // NORMAL SOHBET MODU
    const systemPrompt = PERSONALITIES[personality] || PERSONALITIES.default;

    const response = await client.models.generateContent({
      model: "gemini-3.6-flash",
      contents,
      config: {
        systemInstruction: systemPrompt,
        tools: [WEATHER_TOOL],
      },
    });

    // Model bir fonksiyon çağırmak istiyor mu, kontrol ediyoruz
    const functionCall = response.functionCalls?.[0];

    if (functionCall && functionCall.name === "get_weather") {
      const city = functionCall.args?.city as string;
      const weatherResult = await getWeather(city);

      // Modelin orijinal cevabını (thoughtSignature dahil) olduğu gibi kullanıyoruz
      const modelTurn = response.candidates?.[0]?.content;

      const followUp = await client.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          ...contents,
          modelTurn, // manuel oluşturmak yerine, gelen orijinal içerik
          {
            role: "user",
            parts: [
              {
                functionResponse: {
                  name: "get_weather",
                  response: weatherResult,
                },
              },
            ],
          },
        ],
        config: {
          systemInstruction: systemPrompt,
          tools: [WEATHER_TOOL],
        },
      });

      return Response.json({ answer: followUp.text });
    }

    return Response.json({ answer: response.text });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}