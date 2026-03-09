import { Activity, Download, Newspaper, Search } from "lucide-react";

import { API_BASE_URL, getExportUrl } from "../../api";
import type { NewsArticle } from "../../types";
import { SkeletonList } from "../common/Skeleton";
import { Card, CardContent } from "../ui/card";
import ArticleCard from "./ArticleCard";

interface ArticlesTabProps {
  articles: NewsArticle[];
  selectedDate: string;
  dateLoading: boolean;
  visibleCount: number;
  expandedArticles: Set<number>;
  setExpandedArticles: React.Dispatch<React.SetStateAction<Set<number>>>;
  sentinelRef: React.RefObject<HTMLDivElement>;
  setSearchKeyword: (kw: string) => void;
  showToast: (msg: string) => void;
  bookmarkedIds: Set<number>;
  onToggleBookmark: (articleId: number) => void;
  selectedCategory?: string;
}

export default function ArticlesTab({
  articles,
  selectedDate,
  dateLoading,
  visibleCount,
  expandedArticles,
  setExpandedArticles,
  sentinelRef,
  setSearchKeyword,
  showToast,
  bookmarkedIds,
  onToggleBookmark,
  selectedCategory,
}: ArticlesTabProps) {
  function handleToggleExpand(id: number) {
    setExpandedArticles((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-text-secondary dark:text-gray-400">
          <Newspaper className="h-4 w-4 text-primary" />
          {selectedDate} 기준 <span className="font-semibold text-text-primary dark:text-gray-200">{articles.length.toLocaleString()}건</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Export buttons */}
          <a
            href={getExportUrl("csv", selectedDate, selectedCategory)}
            download
            className="inline-flex items-center gap-1 rounded-lg border border-border dark:border-gray-600 px-2.5 py-1.5 text-xs text-text-secondary dark:text-gray-400 hover:bg-primary-light hover:text-primary transition-colors"
          >
            <Download className="h-3 w-3" /> CSV
          </a>
          <a
            href={getExportUrl("json", selectedDate, selectedCategory)}
            download
            className="inline-flex items-center gap-1 rounded-lg border border-border dark:border-gray-600 px-2.5 py-1.5 text-xs text-text-secondary dark:text-gray-400 hover:bg-primary-light hover:text-primary transition-colors"
          >
            <Download className="h-3 w-3" /> JSON
          </a>
          <div className="flex items-center gap-2 text-xs text-text-tertiary dark:text-gray-500">
            <Activity className="h-3.5 w-3.5" />
            API: {API_BASE_URL || "local"}
          </div>
        </div>
      </div>

      {/* Date-change loading overlay */}
      {dateLoading && <SkeletonList count={3} />}

      {!dateLoading && articles.length === 0 ? (
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface dark:bg-gray-700 mb-4">
              <Search className="h-8 w-8 text-text-tertiary dark:text-gray-500" />
            </div>
            <p className="text-sm text-text-tertiary dark:text-gray-500">선택한 조건에 맞는 기사 데이터가 없습니다.</p>
          </CardContent>
        </Card>
      ) : !dateLoading ? (
        <>
          <div className="space-y-3">
            {articles.slice(0, visibleCount).map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                isExpanded={expandedArticles.has(article.id)}
                onToggleExpand={handleToggleExpand}
                setSearchKeyword={setSearchKeyword}
                showToast={showToast}
                isBookmarked={bookmarkedIds.has(article.id)}
                onToggleBookmark={onToggleBookmark}
              />
            ))}
          </div>

          {/* Skeleton loading placeholders */}
          {visibleCount < articles.length && (
            <div ref={sentinelRef} className="space-y-3 mt-3">
              {[...Array(3)].map((_, i) => (
                <Card key={`skel-${i}`} className="overflow-hidden animate-pulse dark:bg-gray-800 dark:border-gray-700">
                  <div className="flex">
                    <div className="w-1 shrink-0 bg-border-light dark:bg-gray-700" />
                    <div className="flex-1 p-5 space-y-3">
                      <div className="h-4 w-3/4 rounded bg-border-light dark:bg-gray-700" />
                      <div className="h-3 w-1/2 rounded bg-border-light dark:bg-gray-700" />
                      <div className="h-3 w-full rounded bg-border-light dark:bg-gray-700" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Loaded count indicator */}
          <div className="mt-4 text-center text-xs text-text-tertiary dark:text-gray-500">
            {Math.min(visibleCount, articles.length)} / {articles.length}건 표시
          </div>
        </>
      ) : null}
    </>
  );
}
