import { Activity, Newspaper, Search } from "lucide-react";

import { API_BASE_URL } from "../../api";
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
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Newspaper className="h-4 w-4 text-primary" />
          {selectedDate} 기준 <span className="font-semibold text-text-primary">{articles.length.toLocaleString()}건</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          <Activity className="h-3.5 w-3.5" />
          API: {API_BASE_URL}
        </div>
      </div>

      {/* Date-change loading overlay */}
      {dateLoading && <SkeletonList count={3} />}

      {!dateLoading && articles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface mb-4">
              <Search className="h-8 w-8 text-text-tertiary" />
            </div>
            <p className="text-sm text-text-tertiary">선택한 조건에 맞는 기사 데이터가 없습니다.</p>
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
              />
            ))}
          </div>

          {/* Skeleton loading placeholders */}
          {visibleCount < articles.length && (
            <div ref={sentinelRef} className="space-y-3 mt-3">
              {[...Array(3)].map((_, i) => (
                <Card key={`skel-${i}`} className="overflow-hidden animate-pulse">
                  <div className="flex">
                    <div className="w-1 shrink-0 bg-border-light" />
                    <div className="flex-1 p-5 space-y-3">
                      <div className="h-4 w-3/4 rounded bg-border-light" />
                      <div className="h-3 w-1/2 rounded bg-border-light" />
                      <div className="h-3 w-full rounded bg-border-light" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Loaded count indicator */}
          <div className="mt-4 text-center text-xs text-text-tertiary">
            {Math.min(visibleCount, articles.length)} / {articles.length}건 표시
          </div>
        </>
      ) : null}
    </>
  );
}
