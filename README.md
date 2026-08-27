
# LLM App — AI Engineering Öğrenme Projesi

Google Gemini API üzerine kurulu, sıfırdan geliştirilmiş bir chatbot uygulaması. Bu proje, **LLM App Development** alanındaki temel kavramları (prompt engineering, RAG, function calling, AI agents, production pratikleri) gerçek, çalışan bir uygulama üzerinden öğrenmek için adım adım inşa edildi.

🔗 **Canlı demo:** [llm-app-development.vercel.app](https://llm-app-development.vercel.app)

## Özellikler

- 💬 **Konuşma geçmişi** — bot önceki mesajları hatırlıyor
- 🎭 **Çoklu kişilik modu** — Varsayılan, Spor Koçu, Öğretmen, Komedyen
- 📋 **Yapılandırılmış özet** — konuşmayı JSON formatında (ana konu, önemli noktalar, sonuç) özetliyor
- 🌤️ **Function calling** — gerçek zamanlı hava durumu verisi (Open-Meteo API)
- 📄 **RAG (Retrieval-Augmented Generation)** — `.txt` ve `.pdf` dosyaları yükleyip içerikleriyle sohbet edebilme
- 🤖 **AI Agent** — model, birden fazla aracı (doküman arama + hava durumu) kendi kendine sırayla kullanarak çok adımlı sorulara cevap verebiliyor
- 🛡️ **Rate limiting** — dakika başına istek sınırı ile kötüye kullanımı önleme
- ⚠️ **Gelişmiş hata yönetimi** — API kota/yoğunluk hatalarını ayırt edip anlamlı mesajlar verme
- 🧪 **Otomatik test (Evaluation)** — chatbot'un doğruluğunu kontrol eden script

## Teknoloji Yığını

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **LLM:** Google Gemini API (`@google/genai`)
- **PDF işleme:** `pdf-parse`
- **Embedding & Arama:** Gemini embedding modeli + cosine similarity (bellek içi vector arama)

## Kurulum

```bash
npm install
```

`.env.local` dosyası oluştur ve Gemini API key'ini ekle:

```
GEMINI_API_KEY=senin_api_key_in
```

API key'i [Google AI Studio](https://aistudio.google.com) üzerinden ücretsiz alabilirsin.

Geliştirme sunucusunu başlat:

```bash
npm run dev
```

Tarayıcıda [http://localhost:3000](http://localhost:3000) adresini aç.

## Testleri Çalıştırma

Server açıkken, ayrı bir terminalde:

```bash
# Chatbot'un doğru cevap verip vermediğini kontrol eder
node scripts/eval.mjs

# Rate limiting'in doğru çalışıp çalışmadığını kontrol eder
node scripts/rate-limit-test.mjs
```

## Mimari

Sistem mimarisi ve tasarım kararları için [ARCHITECTURE.md](./ARCHITECTURE.md) dosyasına bakabilirsin.

## Öğrenme Yol Haritası

Bu proje, aşağıdaki roadmap'i takip ederek adım adım geliştirildi:

- [x] LLM Fundamentals
- [x] LLM APIs
- [x] Prompt Engineering
- [x] Structured Outputs
- [x] Function / Tool Calling
- [x] Embeddings
- [x] Vector Databases (kavramsal)
- [x] RAG
- [x] AI Agents
- [x] Evaluation
- [x] Production AI (Rate Limiting, Hata Yönetimi)
- [x] AI System Architecture

## Notlar

Bu, üretim ortamına (production) dağıtılmak üzere değil, **öğrenme amacıyla** geliştirilmiş bir projedir. Bilinen sınırlamalar (bellek içi veri depolama, tek kullanıcılı doküman sistemi, ücretsiz API katmanı kısıtları) için [ARCHITECTURE.md](./ARCHITECTURE.md) dosyasındaki "Bilinen Sınırlamalar" bölümüne bakabilirsin.
