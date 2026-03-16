import React, { createContext, useContext, useState, useCallback } from "react";
import { useAiQuery, type AiQueryBodyConversationHistoryItem } from "@workspace/api-client-react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ManagerAIContextValue {
  messages: ChatMessage[];
  isLoading: boolean;
  sendMessage: (question: string) => Promise<void>;
  clearHistory: () => void;
}

const ManagerAIContext = createContext<ManagerAIContextValue | null>(null);

export function ManagerAIProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const mutation = useAiQuery();

  const sendMessage = useCallback(async (question: string) => {
    if (!question.trim() || mutation.isPending) return;

    const userMsg: ChatMessage = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);

    const history: AiQueryBodyConversationHistoryItem[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const result = await mutation.mutateAsync({
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
  }, [messages, mutation]);

  const clearHistory = useCallback(() => setMessages([]), []);

  return (
    <ManagerAIContext.Provider value={{ messages, isLoading: mutation.isPending, sendMessage, clearHistory }}>
      {children}
    </ManagerAIContext.Provider>
  );
}

export function useManagerAI() {
  const ctx = useContext(ManagerAIContext);
  if (!ctx) throw new Error("useManagerAI must be used inside ManagerAIProvider");
  return ctx;
}
