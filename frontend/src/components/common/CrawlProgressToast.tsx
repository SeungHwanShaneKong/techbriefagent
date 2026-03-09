import { Loader2, CheckCircle } from "lucide-react";
import type { CrawlStatusResponse } from "../../types";

interface CrawlProgressToastProps {
  crawlStatus: CrawlStatusResponse;
}

export default function CrawlProgressToast({ crawlStatus }: CrawlProgressToastProps) {
  if (!crawlStatus.is_running && crawlStatus.current_phase !== "completed") return null;

  const isComplete = crawlStatus.current_phase === "completed" && !crawlStatus.is_running;

  return (
    <div className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-2xl border px-5 py-3 shadow-xl backdrop-blur-lg transition-all duration-500 ${
      isComplete
        ? "border-success/30 bg-success/10 dark:bg-success/20"
        : "border-primary/30 bg-white/95 dark:bg-gray-900/95"
    }`}>
      <div className="flex items-center gap-3">
        {isComplete ? (
          <CheckCircle className="h-4 w-4 text-success shrink-0" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium text-text-primary dark:text-gray-200">
            {isComplete ? "수집/분석 완료" : crawlStatus.current_phase === "collecting" ? "기사 수집 중..." : "분석 중..."}
          </p>
          <div className="mt-1 flex items-center gap-3 text-[11px] text-text-secondary dark:text-gray-400">
            <span>수집 {crawlStatus.collection_progress_pct.toFixed(0)}%</span>
            <span>분석 {crawlStatus.analysis_progress_pct.toFixed(0)}%</span>
            <span>{crawlStatus.total_summarized}건 완료</span>
          </div>
          {!isComplete && (
            <div className="mt-1.5 h-1 w-48 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${(crawlStatus.collection_progress_pct + crawlStatus.analysis_progress_pct) / 2}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
