import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Dokümanı küçük parçalara bölüyoruz
function chunkText(text: string, chunkSize: number = 500): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/); // cümlelere göre böl
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > chunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += " " + sentence;
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function getEmbedding(text: string): Promise<number[]> {
  const result = await client.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
  });
  return result.embeddings?.[0]?.values ?? [];
}

// Sunucu belleğinde tutacağımız doküman verisi
export const documentStore: {
  chunks: string[];
  embeddings: number[][];
} = {
  chunks: [],
  embeddings: [],
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string") {
      return Response.json({ error: "Geçerli bir metin gönderilmedi" }, { status: 400 });
    }

    const chunks = chunkText(text);
    const embeddings = await Promise.all(chunks.map((chunk) => getEmbedding(chunk)));

    documentStore.chunks = chunks;
    documentStore.embeddings = embeddings;

    return Response.json({ chunkCount: chunks.length });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}