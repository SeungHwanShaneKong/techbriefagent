import { useEffect, useState } from "react";
import { Menu, Moon, Settings, Sun, X } from "lucide-react";
import type { Notification } from "../../types";
import NotificationCenter from "../common/NotificationCenter";

interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (fn: (v: boolean) => boolean) => void;
  autoRefresh: boolean;
  setAutoRefresh: (fn: (v: boolean) => boolean) => void;
  lastRefreshed: string;
  onOpenAdmin: () => void;
  notifications: Notification[];
  onClearNotifications: () => void;
  onDismissNotification: (id: string) => void;
}

export default function Header({
  sidebarOpen,
  setSidebarOpen,
  autoRefresh,
  setAutoRefresh,
  lastRefreshed,
  onOpenAdmin,
  notifications,
  onClearNotifications,
  onDismissNotification,
}: HeaderProps) {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [dark]);

  function toggleDark() {
    setDark((prev) => {
      const next = !prev;
      localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg shadow-header">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-5 py-3 lg:px-8">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface dark:bg-gray-800 text-text-secondary dark:text-gray-400 lg:hidden"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="메뉴 열기"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white text-lg font-black">
            테
          </div>
          <div>
            <h1 className="text-base font-bold text-text-primary dark:text-gray-100 leading-tight">테.읽.남. Agent</h1>
            <p className="text-[11px] text-text-tertiary dark:text-gray-500">테크 읽어주는 남자 · AI 뉴스 인텔리전스</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setAutoRefresh((prev) => !prev)}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
              autoRefresh
                ? "border-success/30 bg-success/10 text-success"
                : "border-border dark:border-gray-600 bg-surface dark:bg-gray-800 text-text-secondary dark:text-gray-400"
            }`}
          >
            {autoRefresh ? (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
            ) : (
              <span className="inline-flex h-2 w-2 rounded-full bg-text-tertiary" />
            )}
            {autoRefresh ? "실시간" : "일시정지"}
          </button>
          <span className="hidden sm:inline text-[11px] text-text-tertiary dark:text-gray-500">갱신 {lastRefreshed}</span>

          <NotificationCenter
            notifications={notifications}
            onClear={onClearNotifications}
            onDismiss={onDismissNotification}
          />

          <button
            onClick={onOpenAdmin}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface dark:bg-gray-800 text-text-secondary dark:text-gray-400 hover:bg-primary-light hover:text-primary transition-colors"
            aria-label="관리자 설정"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={toggleDark}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface dark:bg-gray-800 text-text-secondary dark:text-gray-400 hover:bg-primary-light hover:text-primary transition-colors"
            aria-label="다크모드 전환"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
