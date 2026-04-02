import { useState, useRef, useEffect, useCallback } from "react";
import { useClientPortalAiQuery, type AiQueryBodyConversationHistoryItem } from "@workspace/api-client-react";
import { Bot, Send, RotateCcw, Mic, MicOff } from "lucide-react";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function PortalAgent({ token }: { token: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useClientPortalAiQuery();
  const { isListening, isSupported, toggleListening } = useVoiceInput({
    onTranscript: (text) => setInput(text),
  });

  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, mutation.isPending]);

  const sendMessage = useCallback(async (question: string) => {
    if (!question.trim() || mutation.isPending || !token) return;

    const userMsg: ChatMessage = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);

    const history: AiQueryBodyConversationHistoryItem[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const result = await mutation.mutateAsync({
        token,
        data: { question: question.trim(), conversationHistory: history },
      });
      const assistantMsg: ChatMessage = { role: "assistant", content: result.content };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  }, [messages, mutation, token]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || mutation.isPending) return;
    setInput("");
    await sendMessage(question);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  const clearHistory = () => {
    setMessages([]);
    setInput("");
  };

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
      <div className="px-6 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? "Listening..." : "Chat With Your Space - Closechain Agent"}
              disabled={mutation.isPending}
              className={cn(
                "w-full px-4 py-2.5 text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 placeholder:text-muted-foreground/70 transition-colors",
                isListening ? "border-red-500" : "border-border"
              )}
            />
            {isSupported && (
              <button
                onClick={toggleListening}
                className={cn(
                  "p-2.5 rounded-xl transition-colors flex-shrink-0",
                  isListening
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={!input.trim() || mutation.isPending}
              className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearHistory}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex-shrink-0"
            title="Clear conversation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>

      {(messages.length > 0 || mutation.isPending) && (
        <div
          ref={chatContainerRef}
          className="border-t border-border px-6 py-4 overflow-y-auto space-y-4"
          style={{ maxHeight: "320px" }}
        >
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-secondary text-foreground rounded-bl-sm"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {mutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-secondary text-foreground rounded-xl rounded-bl-sm px-4 py-3">
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
