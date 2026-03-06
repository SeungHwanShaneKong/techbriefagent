import React from "react";
import dayjs from "dayjs";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

import type { NewsArticle } from "../../types";
import { categoryColor, categoryLabel, isMockSummary, sentimentBadge } from "../../constants";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { Separator } from "../ui/separator";

interface ArticleCardProps {
  article: NewsArticle;
  isExpanded: boolean;
  onToggleExpand: (id: number) => void;
  setSearchKeyword: (kw: string) => void;
  showToast: (msg: string) => void;
}

const ArticleCard = React.memo(function ArticleCard({
  article,
  isExpanded,
  onToggleExpand,
  setSearchKeyword,
  showToast,
}: ArticleCardProps) {
  const summary = article.summary;
  const sentiment = sentimentBadge(summary?.sentiment_score ?? 50);
  const previewText = summary
    ? summary.summary_text
        .split("\n")
        .filter(Boolean)
        .slice(0, 1)
        .join("")
        .replace(/^\d+\.\s*/, "")
        .slice(0, 100)
    : null;

  return (
    <Card className="overflow-hidden group">
      <div className="flex">
        {/* Left accent bar */}
        <div className="w-1 shrink-0" style={{ backgroundColor: categoryColor(article.category) }} />
        <div className="flex-1 p-5">
          {/* Clickable header row for accordion */}
          <button
            className="w-full text-left"
            onClick={() => onToggleExpand(article.id)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-text-primary leading-snug group-hover:text-primary transition-colors">
                  {article.summary?.translated_title || article.title}
                </h3>
                {article.summary?.translated_title && (
                  <p className="mt-0.5 text-xs text-text-tertiary italic truncate">{article.title}</p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                  <span className="font-medium">{article.publisher}</span>
                  <span className="text-text-tertiary">·</span>
                  <span>{dayjs(article.pub_date).format("YYYY-MM-DD HH:mm")}</span>
                  <span className="text-text-tertiary">·</span>
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                    style={{ backgroundColor: categoryColor(article.category) }}
                  >
                    {categoryLabel(article.category)}
                  </span>
                </div>
                {/* Preview when collapsed */}
                {!isExpanded && previewText && (
                  <p className="mt-2 text-xs text-text-tertiary line-clamp-1">{previewText}…</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-text-tertiary" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-text-tertiary" />
                )}
              </div>
            </div>
          </button>

          {/* Expandable detail section */}
          {isExpanded && (
            <div className="mt-4 animate-[fadeIn_0.2s_ease]">
              <div className="flex justify-end mb-2">
                <a
                  className="flex items-center gap-1 shrink-0 rounded-xl bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-primary-light hover:text-primary transition-colors"
                  href={article.original_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  원문 <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {summary ? (
                <div>
                  {isMockSummary(article) && (
                    <div className="mb-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-2.5 text-xs text-warning">
                      모의 요약으로 감지되었습니다. 좌측 &quot;보정&quot; 버튼으로 교정할 수 있습니다.
                    </div>
                  )}

                  {/* Clickable keywords */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {summary.keywords
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean)
                      .slice(0, 8)
                      .map((kw) => (
                        <button
                          key={`${article.id}-${kw}`}
                          className="inline-flex items-center rounded-full bg-surface border border-border/60 px-2.5 py-1 text-[11px] text-text-secondary hover:bg-primary-light hover:text-primary hover:border-primary/30 transition-colors cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSearchKeyword(kw);
                            showToast(`"${kw}" 키워드로 필터링합니다`);
                          }}
                        >
                          {kw}
                        </button>
                      ))}
                  </div>

                  <Separator className="my-3" />

                  {/* Summary text */}
                  <div className="space-y-2 text-sm leading-relaxed text-text-primary">
                    {summary.summary_text
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((line, idx) => (
                        <p key={`${article.id}-line-${idx}`}>
                          <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-md bg-primary-light text-[11px] font-bold text-primary">
                            {idx + 1}
                          </span>
                          {line.replace(/^\d+\.\s*/, "")}
                        </p>
                      ))}
                  </div>

                  {/* Sentiment */}
                  <div className="mt-4 flex items-center gap-2">
                    <Badge variant={sentiment.variant}>
                      감성 {sentiment.label} ({(summary.sentiment_score ?? 50).toFixed(1)}/100)
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-surface p-4 text-center">
                  <p className="text-sm text-text-tertiary">요약이 아직 생성되지 않았습니다.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
});

export default ArticleCard;
