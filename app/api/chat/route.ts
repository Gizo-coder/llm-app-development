import { GoogleGenAI, Type } from "@google/genai";
import { documentStore } from "../upload/route";

// --- RATE LIMITING ---

const RATE_LIMIT = 5; // dakikada izin verilen maksimum istek
const RATE_WINDOW_MS = 60 * 1000; // 1 dakika

const requestLog: Record<string, number[]> = {};

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const timestamps = requestLog[identifier] || [];

  // Sadece son 1 dakika içindeki istekleri say, eskileri temizle
  const recentTimestamps = timestamps.filter((t) => now - t < RATE_WINDOW_MS);

  if (recentTimestamps.length >= RATE_LIMIT) {
    return true; // limit aşıldı
  }

  recentTimestamps.push(now);
  requestLog[identifier] = recentTimestamps;
  return false; // henüz limit aşılmadı
}

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

// Yüklenen dokümanda soruya en yakın parçaları buluyoruz
async function findRelevantChunks(question: string, topN: number = 3): Promise<string[]> {
  if (documentStore.chunks.length === 0) return [];

  const questionEmbedding = await getEmbedding(question);

  const scored = documentStore.chunks.map((chunk, i) => ({
    text: chunk,
    score: cosineSimilarity(questionEmbedding, documentStore.embeddings[i]),
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

// Modelin bilmesi gereken "araç" tanımları
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

const SEARCH_DOCUMENT_TOOL = {
  functionDeclarations: [
    {
      name: "search_document",
      description:
        "Yüklenen dokümanda (varsa) belirli bir bilgiyi arar. Kullanıcının sorusuyla ilgili dokümanda bilgi olabileceğini düşündüğünde bu aracı kullan.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description: "Dokümanda aranacak soru veya konu",
          },
        },
        required: ["query"],
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
     // Basit bir kimlik belirleyici (gerçek production'da IP adresi kullanılır)
    const identifier =
      request.headers.get("x-forwarded-for") || "anonymous";

    if (isRateLimited(identifier)) {
      return Response.json(
        { error: "Çok fazla istek gönderdiniz. Lütfen bir dakika bekleyip tekrar deneyin." },
        { status: 429 }
      );
    }
    const body = await request.json();
    const { messages, personality, summarize, askKnowledge, askDocument, agentMode } = body;

    const contents = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    // AGENT MODU (diğer tüm modlardan önce kontrol ediyoruz — en yüksek öncelik)
    if (agentMode) {
      const systemPrompt = PERSONALITIES[personality] || PERSONALITIES.default;
      const allTools = [WEATHER_TOOL, SEARCH_DOCUMENT_TOOL];

      let currentContents = [...contents];
      let finalAnswer = "";
      const stepsLog: string[] = [];

      const MAX_STEPS = 5; // sonsuz döngüyü önlemek için güvenlik sınırı

      for (let step = 0; step < MAX_STEPS; step++) {
        const response = await client.models.generateContent({
          model: "gemini-3.6-flash",
          contents: currentContents,
          config: {
            systemInstruction: systemPrompt,
            tools: allTools,
          },
        });

        const functionCall = response.functionCalls?.[0];

        // Model artık araç kullanmak istemiyor, nihai cevabı verdi
        if (!functionCall) {
          finalAnswer = response.text ?? "";
          break;
        }

        // Model bir araç çağırmak istiyor, hangisi olduğuna bakıyoruz
        let toolResult: object;

        if (functionCall.name === "get_weather") {
          const city = functionCall.args?.city as string;
          toolResult = await getWeather(city);
          stepsLog.push(`🌤️ Hava durumu arandı: ${city}`);
        } else if (functionCall.name === "search_document") {
          const query = functionCall.args?.query as string;
          const chunks = await findRelevantChunks(query);
          toolResult = { results: chunks.length > 0 ? chunks : ["Dokümanda bulunamadı"] };
          stepsLog.push(`📄 Dokümanda arandı: ${query}`);
        } else {
          toolResult = { error: "Bilinmeyen araç" };
        }

        // Modelin bu adımdaki cevabını (thoughtSignature dahil) geçmişe ekliyoruz
        const modelTurn = response.candidates?.[0]?.content;
        currentContents = [
          ...currentContents,
          modelTurn,
          {
            role: "user",
            parts: [
              {
                functionResponse: {
                  name: functionCall.name,
                  response: toolResult,
                },
              },
            ],
          },
        ];
      }

      return Response.json({ answer: finalAnswer, agentSteps: stepsLog });
    }

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

    // DOKÜMAN MODU (RAG)
    if (askDocument) {
      const lastMessage = messages[messages.length - 1]?.content ?? "";
      const relevantChunks = await findRelevantChunks(lastMessage);

      if (relevantChunks.length === 0) {
        return Response.json({
          answer: "Henüz bir doküman yüklenmedi. Lütfen önce bir dosya yükle.",
        });
      }

      const response = await client.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [{ role: "user", parts: [{ text: lastMessage }] }],
        config: {
          systemInstruction: `Sen yüklenen dokümana dair sorulara cevap veren bir asistansın. SADECE aşağıdaki doküman parçalarını kullanarak cevap ver, kendi genel bilgini ekleme.

Doküman parçaları:
${relevantChunks.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}

Eğer soru bu parçalarla cevaplanamıyorsa "Dokümanda bu bilgiye rastlamadım" de.`,
        },
      });

      return Response.json({
        answer: response.text,
        usedChunks: relevantChunks,
      });
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

    // Gemini API'den gelen hatayı daha anlamlı hale getiriyoruz
    if (error && typeof error === "object" && "status" in error) {
      const status = (error as { status?: number }).status;

      if (status === 429) {
        return Response.json(
          { error: "API kullanım kotası doldu. Lütfen birkaç saniye bekleyip tekrar deneyin." },
          { status: 429 }
        );
      }

      if (status === 503) {
        return Response.json(
          { error: "Gemini şu an yoğun, lütfen tekrar deneyin." },
          { status: 503 }
        );
      }
    }

    return Response.json(
      { error: "Beklenmeyen bir hata oluştu." },
      { status: 500 }
    );
  }
}