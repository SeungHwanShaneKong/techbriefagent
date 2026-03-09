import { useState, useRef, useEffect } from "react";
import { Bell, X } from "lucide-react";
import type { Notification } from "../../types";

interface NotificationCenterProps {
  notifications: Notification[];
  onClear: () => void;
  onDismiss: (id: string) => void;
}

export default function NotificationCenter({ notifications, onClear, onDismiss }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-surface dark:bg-gray-800 text-text-secondary dark:text-gray-400 hover:bg-primary-light hover:text-primary transition-colors"
        aria-label="알림"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-2xl border border-border dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl">
          <div className="flex items-center justify-between border-b border-border dark:border-gray-700 px-4 py-3">
            <span className="text-sm font-semibold text-text-primary dark:text-gray-200">알림</span>
            {notifications.length > 0 && (
              <button onClick={onClear} className="text-[11px] text-text-tertiary hover:text-primary transition-colors">
                모두 지우기
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="py-8 text-center text-xs text-text-tertiary dark:text-gray-500">알림이 없습니다.</p>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-2.5 border-b border-border/50 dark:border-gray-800 px-4 py-3 ${!n.read ? "bg-primary-light/30 dark:bg-primary/5" : ""}`}
                >
                  <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                    n.type === "error" ? "bg-danger" :
                    n.type === "crawl_complete" ? "bg-success" :
                    n.type === "agent_complete" ? "bg-primary" : "bg-text-tertiary"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-text-primary dark:text-gray-300">{n.message}</p>
                    <p className="text-[10px] text-text-tertiary dark:text-gray-600 mt-0.5">
                      {new Date(n.timestamp).toLocaleTimeString("ko-KR")}
                    </p>
                  </div>
                  <button onClick={() => onDismiss(n.id)} className="shrink-0 text-text-tertiary hover:text-primary transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
