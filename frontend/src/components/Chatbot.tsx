import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { sendChatbotMessage, type ChatMessage } from "../api";

/* ═══════════════════════════════════════════════════════════════════════
   Floating AI Chatbot Component
   - Always visible as a floating button (AI-shaped)
   - Opens a chat dialog on click
   - Answers ONLY from crawled news data
   - Responses are always 3 bullet points
   ═══════════════════════════════════════════════════════════════════════ */

interface DisplayMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  sourceCount?: number;
  isLoading?: boolean;
}

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      id: 0,
      role: "assistant",
      content:
        "• 안녕하세요! 테.읽.남. AI 어시스턴트입니다.\n• 크롤링된 뉴스 데이터를 기반으로 질문에 답변합니다.\n• 궁금한 점을 자유롭게 물어보세요!",
    },
  ]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const msgIdRef = useRef(1);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  const handleSend = useCallback(async () => {
    const question = input.trim();
    if (!question || sending) return;

    const userMsgId = msgIdRef.current++;
    const loadingMsgId = msgIdRef.current++;

    // Add user message + loading placeholder
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: question },
      { id: loadingMsgId, role: "assistant", content: "", isLoading: true },
    ]);
    setInput("");
    setSending(true);

    try {
      // Build history from previous messages (exclude loading)
      const history: ChatMessage[] = messages
        .filter((m) => !m.isLoading)
        .map((m) => ({ role: m.role, content: m.content }));

      const result = await sendChatbotMessage(question, history);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsgId
            ? {
                ...m,
                content: result.answer,
                isLoading: false,
                sourceCount: result.source_count,
              }
            : m,
        ),
      );
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsgId
            ? {
                ...m,
                content: `• 요청 처리 중 오류가 발생했습니다.\n• ${errorMsg}\n• 잠시 후 다시 시도해 주세요.`,
                isLoading: false,
              }
            : m,
        ),
      );
    } finally {
      setSending(false);
    }
  }, [input, sending, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <>
      {/* ── Floating AI Button ── */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-110 focus:outline-none ${
          open
            ? "bg-gray-600 text-white rotate-0"
            : "bg-gradient-to-br from-primary to-primary/80 text-white"
        }`}
        aria-label={open ? "챗봇 닫기" : "테.읽.남. AI 챗봇 열기"}
        title="테.읽.남. AI 뉴스 챗봇"
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <Sparkles className="h-6 w-6 animate-pulse" />
        )}
      </button>

      {/* ── Chat Dialog ── */}
      {open && (
        <div
          role="dialog"
          aria-label="AI 챗봇"
          aria-modal="true"
          className="fixed bottom-24 right-6 z-50 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl animate-fade-in dark:bg-dark-panel dark:border-dark-border"
          style={{ height: "min(520px, calc(100vh - 8rem))" }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 bg-gradient-to-r from-primary to-primary/80 px-5 py-4 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold leading-tight">
                테.읽.남. AI 어시스턴트
              </h3>
              <p className="text-xs text-white/80">
                테크 읽어주는 남자 · 3줄 핵심 요약
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-1 transition hover:bg-white/20"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            role="log"
            aria-live="polite"
            aria-label="채팅 메시지"
            className="flex-1 min-h-0 space-y-3 overflow-y-auto px-4 py-4"
            style={{ scrollBehavior: "smooth" }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-white rounded-br-md"
                      : "bg-gray-100 dark:bg-dark-surface text-gray-800 dark:text-dark-text-primary rounded-bl-md"
                  }`}
                >
                  {msg.isLoading ? (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-xs">뉴스 데이터 분석 중...</span>
                    </div>
                  ) : (
                    <>
                      {msg.content.split("\n").map((line, i) => (
                        <p key={i} className={i > 0 ? "mt-1.5" : ""}>
                          {line}
                        </p>
                      ))}
                      {msg.role === "assistant" && msg.sourceCount != null && (
                        <p className="mt-2 text-[10px] text-gray-400">
                          📰 {msg.sourceCount}건의 뉴스 참조
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 bg-white px-4 py-3 dark:border-dark-border dark:bg-dark-panel">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <MessageCircle className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="뉴스에 대해 질문하세요..."
                  aria-label="질문 입력"
                  disabled={sending}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 dark:bg-dark-surface dark:border-dark-border dark:text-dark-text-primary dark:placeholder:text-dark-text-tertiary"
                />
              </div>
              <button
                onClick={() => void handleSend()}
                disabled={!input.trim() || sending}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white transition hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="전송"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
