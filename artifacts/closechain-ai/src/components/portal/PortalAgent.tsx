import { useState, useRef, useEffect, useCallback } from "react";
import { useClientPortalAiQuery, type AiQueryBodyConversationHistoryItem } from "@workspace/api-client-react";
import { Bot, Send, X, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function PortalAgent({ token }: { token: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mutation = useClientPortalAiQuery();

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) {
      textareaRef.current?.focus();
    }
  }, [isOpen]);

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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-full shadow-xl hover:bg-primary/90 transition-all hover:scale-105",
          isOpen && "hidden"
        )}
      >
        <MessageCircle className="w-5 h-5" />
        <span className="font-semibold text-sm">Closechain Agent</span>
      </button>

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] bg-card rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden" style={{ height: "520px" }}>
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground rounded-t-2xl">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <span className="font-semibold text-sm">Closechain Agent</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Bot className="w-10 h-10 text-primary/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-1 font-medium">How can I help you?</p>
                <p className="text-xs text-muted-foreground mb-4">Ask me about this project's closeout status, documents, or subcontractors.</p>
                <div className="space-y-2">
                  {[
                    "What's the overall project progress?",
                    "Which documents are still missing?",
                    "Show me subcontractor status",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => { setInput(suggestion); textareaRef.current?.focus(); }}
                      className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
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
                <div className="bg-secondary text-foreground rounded-xl rounded-bl-sm px-3.5 py-2.5">
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-border">
            <div className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about this project..."
                rows={2}
                disabled={mutation.isPending}
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || mutation.isPending}
                className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
