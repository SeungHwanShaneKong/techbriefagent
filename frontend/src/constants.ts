import type {
  CrawlStatusResponse,
  DailyBriefResponse,
  NewsArticle,
  StatsResponse,
} from "./types";

/* ═══════════════════════════════════════════════════════════════════════
   Category maps
   ═══════════════════════════════════════════════════════════════════════ */

export const CATEGORY_LABEL_MAP: Record<string, string> = {
  AI: "인공지능",
  Robotics: "로보틱스",
  "Bio-tech": "바이오 테크",
  Semiconductor: "반도체",
  Blockchain: "블록체인",
  "General Tech": "일반 기술",
};

export const CATEGORY_OPTIONS = [
  { label: "전체", value: "All" },
  { label: "인공지능", value: "AI" },
  { label: "로보틱스", value: "Robotics" },
  { label: "바이오 테크", value: "Bio-tech" },
  { label: "반도체", value: "Semiconductor" },
  { label: "블록체인", value: "Blockchain" },
  { label: "일반 기술", value: "General Tech" },
];

export const CATEGORY_COLORS: Record<string, string> = {
  AI: "#FF6B35",
  Robotics: "#34C759",
  "Bio-tech": "#AF52DE",
  Semiconductor: "#007AFF",
  Blockchain: "#FF9500",
  "General Tech": "#8E8E93",
};

/* ═══════════════════════════════════════════════════════════════════════
   Helper functions
   ═══════════════════════════════════════════════════════════════════════ */

export function categoryLabel(code: string): string {
  return CATEGORY_LABEL_MAP[code] ?? code;
}

export function categoryColor(code: string): string {
  return CATEGORY_COLORS[code] ?? "#8E8E93";
}

export function isMockSummary(article: NewsArticle): boolean {
  if (!article.summary) return false;
  const keywords = String(article.summary.keywords ?? "").toLowerCase();
  const summaryText = String(article.summary.summary_text ?? "").toLowerCase();
  return (
    keywords.includes("mock") ||
    summaryText.includes("api 키 미설정") ||
    summaryText.includes("모의 요약") ||
    summaryText.includes("openai_api_key")
  );
}

export function sentimentBadge(score: number): {
  label: string;
  variant: "success" | "danger" | "warning";
} {
  if (score > 65) return { label: "긍정", variant: "success" as const };
  if (score < 40) return { label: "부정", variant: "danger" as const };
  return { label: "중립", variant: "warning" as const };
}

/* ═══════════════════════════════════════════════════════════════════════
   Default state factories
   ═══════════════════════════════════════════════════════════════════════ */

export function defaultCrawlStatus(): CrawlStatusResponse {
  return {
    is_running: false,
    target_min_articles: 0,
    current_recent_articles: 0,
    total_cycles: 0,
    total_summarized: 0,
    cycle_target_articles: 0,
    cycle_processed_articles: 0,
    current_phase: "idle",
    collection_progress_pct: 0,
    analysis_progress_pct: 0,
    pending_analysis_count: 0,
    degraded_summary_count: 0,
    message: "초기화 중",
  };
}

export function defaultStats(): StatsResponse {
  return {
    total_articles: 0,
    categories: {},
    recent_keywords: [],
    usage: {
      current_model: "gpt-4o-mini",
      total_requests: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      total_estimated_cost_usd: 0,
      total_estimated_cost_krw: 0,
      usd_to_krw_rate: 1350,
      input_cost_per_1m: 0.25,
      output_cost_per_1m: 2.0,
    },
    daily_cost: [],
  };
}

export function defaultDailyBrief(date: string): DailyBriefResponse {
  return {
    target_date: date,
    total_articles: 0,
    unique_publishers: 0,
    average_sentiment: 50,
    top_categories: {},
    top_keywords: [],
    summary_lines: [],
    category_reports: [],
    generated_with_model: false,
  };
}
