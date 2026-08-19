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

  async function sendMessage() {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.content }),
      });

      const data = await res.json();

      if (data.answer) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.answer },
        ]);
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