import { GoogleGenAI } from "@google/genai";
import { PDFParse } from "pdf-parse";

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Dokümanı küçük parçalara bölüyoruz
function chunkText(text: string, chunkSize: number = 500): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
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

export const documentStore: {
  chunks: string[];
  embeddings: number[][];
} = {
  chunks: [],
  embeddings: [],
};

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let text = "";

    if (contentType.includes("multipart/form-data")) {
      // PDF ya da dosya olarak gönderilmiş
      const formData = await request.formData();
      const file = formData.get("file") as File;

     if (file.type === "application/pdf") {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        text = result.text;
      } else {
        text = await file.text();
      }
    } else {
      // Eski yöntem: düz JSON ile metin gönderme (txt için hâlâ destekliyoruz)
      const body = await request.json();
      text = body.text;
    }

    if (!text || text.trim().length === 0) {
      return Response.json({ error: "Dosyadan metin çıkarılamadı" }, { status: 400 });
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