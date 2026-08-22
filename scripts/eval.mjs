// Basit bir Evaluation (test) scripti
// Chatbot'un doküman sorularını doğru cevaplayıp cevaplamadığını otomatik kontrol eder

const API_URL = "http://localhost:3000/api/chat";

// Test senaryoları: her biri bir soru ve o cevapta GEÇMESİ BEKLENEN anahtar kelime(ler)
const testCases = [
  {
    name: "Kuruluş yılı",
    question: "TechNova ne zaman kuruldu?",
    expectedKeywords: ["2021"],
  },
  {
    name: "CEO bilgisi",
    question: "Şirketin CEO'su kim?",
    expectedKeywords: ["Ahmet Yılmaz"],
  },
  {
    name: "Premium paket fiyatı",
    question: "NovaMuhasebe'nin premium paketi ne kadar?",
    expectedKeywords: ["79"],
  },
  {
    name: "Müşteri sayısı",
    question: "Kaç aktif müşterileri var?",
    expectedKeywords: ["3.500", "3500"], // ikisinden biri geçerse yeterli
  },
  {
    name: "Şehir + hava durumu (Agent testi)",
    question: "TechNova'nın bulunduğu şehrin hava durumu nasıl?",
    expectedKeywords: ["İstanbul"],
    useAgent: true, // bu test agent modunu kullanacak
  },
];

async function runTest(testCase) {
  const body = {
    messages: [{ role: "user", content: testCase.question }],
    askDocument: !testCase.useAgent,
    agentMode: !!testCase.useAgent,
  };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  const answer = data.answer ?? "";

  const passed = testCase.expectedKeywords.some((keyword) =>
    answer.toLowerCase().includes(keyword.toLowerCase())
  );

  return { ...testCase, answer, passed };
}

async function runAllTests() {
  console.log("🧪 Eval başlıyor...\n");

  const results = [];

  for (const testCase of testCases) {
    const result = await runTest(testCase);
    results.push(result);

    const icon = result.passed ? "✅" : "❌";
    console.log(`${icon} ${result.name}`);
    console.log(`   Soru: ${result.question}`);
    console.log(`   Cevap: ${result.answer.slice(0, 100)}...`);
    console.log("");
  }

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  console.log("─────────────────────────");
  console.log(`Sonuç: ${passedCount}/${totalCount} test başarılı`);

  if (passedCount < totalCount) {
    process.exit(1); // başarısız testler varsa, script'in "hata ile bitti" demesini sağlıyoruz
  }
}

runAllTests();