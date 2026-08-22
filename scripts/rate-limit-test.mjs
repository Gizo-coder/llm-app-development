// Rate Limiting testi
// Art arda hızlıca çok sayıda istek atıp, limitin doğru çalışıp çalışmadığını kontrol eder

const API_URL = "http://localhost:3000/api/chat";
const TOTAL_REQUESTS = 15; // limit 10 olduğu için, 11-15 arası reddedilmeli

async function sendRequest(index) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: `Test mesajı ${index}` }],
      personality: "default",
    }),
  });

  return { index, status: res.status };
}

async function runRateLimitTest() {
  console.log(`🧪 Rate limit testi başlıyor: ${TOTAL_REQUESTS} istek art arda gönderiliyor...\n`);

  // İstekleri birbirini beklemeden, hepsini aynı anda (paralel) gönderiyoruz
  const promises = Array.from({ length: TOTAL_REQUESTS }, (_, i) => sendRequest(i + 1));
  const results = await Promise.all(promises);

  let successCount = 0;
  let blockedCount = 0;

  results.forEach((result) => {
    if (result.status === 200) {
      successCount++;
      console.log(`✅ İstek ${result.index}: Başarılı (200)`);
    } else if (result.status === 429) {
      blockedCount++;
      console.log(`🚫 İstek ${result.index}: Engellendi (429 - Rate Limit)`);
    } else {
      console.log(`⚠️ İstek ${result.index}: Beklenmeyen durum (${result.status})`);
    }
  });

  console.log("\n─────────────────────────");
  console.log(`Başarılı: ${successCount}, Engellenen: ${blockedCount}`);

  if (blockedCount > 0) {
    console.log("✅ Rate limiting çalışıyor gibi görünüyor!");
  } else {
    console.log("❌ Hiçbir istek engellenmedi, rate limiting çalışmıyor olabilir.");
  }
}

runRateLimitTest();