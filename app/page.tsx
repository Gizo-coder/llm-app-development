"use client";

import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [personality, setPersonality] = useState("default");
  const [summary, setSummary] = useState<{
    ana_konu: string;
    onemli_noktalar: string[];
    sonuc: string;
  } | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [knowledgeMode, setKnowledgeMode] = useState(false);
  const [usedFact, setUsedFact] = useState<string | null>(null);

  async function sendMessage() {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setUsedFact(null); // Reset used fact when sending a new message

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage], personality, askKnowledge: knowledgeMode
        }),
      });

      const data = await res.json();

      if (data.answer) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.answer },
        ]);
        if (data.usedFact) {
          setUsedFact(data.usedFact);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Bir hata oluştu." },
        ]);
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Bağlantı hatası." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function summarizeConversation() {
  if (messages.length === 0) return;
  setSummarizing(true);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, summarize: true }),
    });

    const data = await res.json();
    if (data.summary) {
      setSummary(data.summary);
     }
    } catch (error) {
      console.error(error);
    } finally {
      setSummarizing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="w-full max-w-2xl flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-black dark:text-white">
          Basit Chatbot
        </h1>
        <select
          value={personality}
          onChange={(e) => setPersonality(e.target.value)}
          className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-white text-sm w-fit"
        >
          <option value="default">Varsayılan</option>
          <option value="coach">Spor Koçu</option>
          <option value="teacher">Öğretmen</option>
          <option value="comedian">Komedyen</option>
        </select>
        <button
          onClick={summarizeConversation}
          disabled={summarizing || messages.length === 0}
          className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm disabled:opacity-50"
        >
          {summarizing ? "Özetleniyor..." : "Konuşmayı Özetle"}
        </button>
        <button
          onClick={() => setKnowledgeMode((prev) => !prev)}
          className={`px-3 py-2 rounded-lg border text-sm ${
            knowledgeMode
              ? "bg-blue-500 text-white border-blue-500"
              : "border-zinc-300 dark:border-zinc-700"
          }`}
        >
          {knowledgeMode ? "🧠 Bilgi Bankası Modu: AÇIK" : "🧠 Bilgi Bankası Modu: KAPALI"}
        </button>

        <div className="flex flex-col gap-3 min-h-[300px] p-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
          {messages.length === 0 && (
            <p className="text-zinc-400 text-sm">
              Henüz mesaj yok. Bir şeyler yaz ve gönder.
            </p>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[80%] px-4 py-2 rounded-lg ${
                msg.role === "user"
                  ? "self-end bg-blue-500 text-white"
                  : "self-start bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white"
              }`}
            >
              {msg.content}
            </div>
          ))}

          {loading && (
            <p className="text-zinc-400 text-sm self-start">
              Yazıyor...
            </p>
          )}
        </div>
        {summary && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg text-sm">
          <p className="font-semibold mb-2">📋 {summary.ana_konu}</p>
          <ul className="list-disc list-inside mb-2 space-y-1">
            {summary.onemli_noktalar.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
          <p className="text-zinc-600 dark:text-zinc-400">
            <strong>Sonuç:</strong> {summary.sonuc}
          </p>
        </div>
      )}
      {usedFact && (
        <p className="text-xs text-zinc-500 italic">
          💡 Kullanılan bilgi: &quot;{usedFact}&quot;
        </p>
      )}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Bir mesaj yaz..."
            className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-white"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black disabled:opacity-50"
          >
            Gönder
          </button>
        </div>
      </div>
    </div>
  );
}