import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import { Bookmark, ExternalLink, Loader2, Trash2 } from "lucide-react";

import type { BookmarkResponse } from "../../types";
import { fetchBookmarks, removeBookmark } from "../../api";
import { categoryColor, categoryLabel } from "../../constants";
import { Card } from "../ui/card";

interface BookmarksTabProps {
  showToast: (msg: string) => void;
  onBookmarkChange: () => void;
}

export default function BookmarksTab({ showToast, onBookmarkChange }: BookmarksTabProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchBookmarks();
      setBookmarks(data);
    } catch {
      showToast("북마크 로딩 실패");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRemove(id: number) {
    try {
      await removeBookmark(id);
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
      onBookmarkChange();
      showToast("북마크가 삭제되었습니다");
    } catch {
      showToast("북마크 삭제 실패");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-tertiary dark:text-gray-500">
        <Bookmark className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm">저장된 북마크가 없습니다.</p>
        <p className="text-xs mt-1">기사 카드의 별 아이콘을 클릭하여 북마크하세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary dark:text-gray-200">
          <Bookmark className="mr-1.5 inline h-4 w-4 text-primary" />
          저장된 기사 ({bookmarks.length}건)
        </h3>
      </div>
      {bookmarks.map((bm) => {
        const article = bm.article;
        if (!article) return null;
        return (
          <Card key={bm.id} className="overflow-hidden group">
            <div className="flex">
              <div className="w-1 shrink-0" style={{ backgroundColor: categoryColor(article.category) }} />
              <div className="flex-1 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-text-primary dark:text-gray-200 leading-snug">
                      {article.summary?.translated_title || article.title}
                    </h4>
                    {article.summary?.translated_title && (
                      <p className="mt-0.5 text-xs text-text-tertiary dark:text-gray-500 italic truncate">{article.title}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary dark:text-gray-400">
                      <span className="font-medium">{article.publisher}</span>
                      <span className="text-text-tertiary dark:text-gray-600">·</span>
                      <span>{dayjs(article.pub_date).format("YYYY-MM-DD")}</span>
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                        style={{ backgroundColor: categoryColor(article.category) }}
                      >
                        {categoryLabel(article.category)}
                      </span>
                    </div>
                    {article.summary && (
                      <p className="mt-2 text-xs text-text-secondary dark:text-gray-400 line-clamp-2">
                        {article.summary.summary_text.split("\n").filter(Boolean).slice(0, 1).join("").replace(/^\d+\.\s*/, "").slice(0, 150)}
                      </p>
                    )}
                    {bm.note && (
                      <p className="mt-1.5 rounded-lg bg-primary-light dark:bg-primary/10 px-2.5 py-1.5 text-xs text-primary">
                        {bm.note}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-text-tertiary dark:text-gray-600">
                      저장일: {dayjs(bm.created_at).format("YYYY-MM-DD HH:mm")}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <a
                      href={article.original_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg p-1.5 text-text-tertiary hover:text-primary hover:bg-primary-light transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button
                      onClick={() => handleRemove(bm.id)}
                      className="rounded-lg p-1.5 text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
