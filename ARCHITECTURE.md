# Mimari

Bu doküman, chatbot'un sistem mimarisini ve tasarım kararlarını açıklar.

## Genel Bakış

```
Kullanıcı arayüzü (Next.js frontend)
        ↓
API Route (route.ts)
        ↓
Rate Limiting → Mod Seçimi
        ↓
   ┌────┴────┬──────────────┐
   ↓         ↓              ↓
Gemini API  Hava Durumu   Doküman Deposu
(LLM)       (Open-Meteo)  (RAG / embedding arama)
```

## Katmanlar

**1. Frontend (`app/page.tsx`)**
React ile yazılmış, kullanıcının mesaj yazıp gönderdiği, cevapları gördüğü arayüz. Hangi modun (bilgi bankası, doküman, agent) aktif olduğunu tutan state burada yönetiliyor.

**2. API Katmanı (`app/api/chat/route.ts`)**
Tüm isteklerin geçtiği tek nokta. Sırasıyla şunları yapar:
- Rate limiting kontrolü (dakikada 5 istek — Gemini'nin ücretsiz katman limitiyle uyumlu)
- Gelen isteğe göre doğru modu seçme (agent / özet / bilgi bankası / doküman / normal sohbet)
- Gemini API'ye istek gönderme ve cevabı işleme

**3. LLM (Gemini API)**
Asıl "düşünme" işini yapan model. Kullanılan model: `gemini-3.6-flash`.

**4. Araçlar (Tools)**
- **Hava durumu:** Open-Meteo API üzerinden gerçek zamanlı veri
- **Doküman deposu:** Yüklenen dosyaların (txt/pdf) parçalara bölünüp embedding'e çevrildiği, bellekte tutulan basit bir arama sistemi

## Modlar

| Mod | Ne zaman devreye girer | Ne yapar |
|---|---|---|
| Agent | `agentMode: true` | Modelin kendi kendine birden fazla aracı sırayla kullanmasına izin verir (örn. önce dokümanda ara, sonra hava durumuna bak) |
| Özet | `summarize: true` | Konuşmayı yapılandırılmış JSON formatında özetler |
| Bilgi Bankası | `askKnowledge: true` | Sabit, kod içi bir bilgi kümesinde embedding ile arama yapar |
| Doküman (RAG) | `askDocument: true` | Yüklenen dosyada embedding ile arama yapar |
| Normal Sohbet | (varsayılan) | Serbest sohbet + hava durumu function calling |

## Bilinen Sınırlamalar

- **Doküman deposu bellekte tutuluyor:** Server yeniden başladığında (`npm run dev` her açılışında) yüklenen dosya siliniyor. Gerçek bir production sisteminde bu, Redis veya bir veritabanında saklanırdı.
- **Rate limiting bellekte tutuluyor:** Aynı sebeple, server yeniden başladığında istek sayaçları sıfırlanıyor. Çoklu sunucu (multi-instance) bir ortamda bu yaklaşım çalışmaz, paylaşılan bir depolama (Redis gibi) gerekir.
- **Tek kullanıcılı doküman deposu:** Şu an herkes aynı dokümanı paylaşıyor. Gerçek bir üründe, her kullanıcının kendi doküman alanı olması gerekir (kullanıcı bazlı veritabanı kaydı).
- **Ücretsiz katman kısıtları:** Gemini'nin ücretsiz katmanı günlük/dakikalık istek limitleriyle sınırlı, bu da gerçek kullanıcı trafiğinde yetersiz kalır.

## Ölçeklendirme Düşünceleri

Bu proje 1000+ kullanıcıya çıksa, değişmesi gereken başlıca noktalar:
1. **Doküman deposu → gerçek bir vector database** (Pinecone, Chroma, pgvector) taşınmalı
2. **Rate limiting → Redis tabanlı** bir çözüme geçmeli (paylaşılan, kalıcı sayaç için)
3. **API key güvenliği → backend'de merkezi ve izlenebilir** hale getirilmeli (kullanım başına maliyet takibi eklenmeli)
4. **Model seçimi → ücretli bir katmana** geçilmeli (ücretsiz katmanın limitleri gerçek trafiği kaldırmaz)
5. **Loglama → yapılandırılmış (structured) loglama** sistemine geçmeli (şu an sadece `console.error` kullanılıyor)