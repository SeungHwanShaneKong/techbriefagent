export interface AISummary {
  id: number;
  article_id: number;
  summary_text: string;
  keywords: string;
  sentiment_score: number;
  translated_title?: string | null;
}

export interface NewsArticle {
  id: number;
  title: string;
  original_url: string;
  publisher: string;
  pub_date: string;
  category: string;
  raw_content: string;
  created_at: string;
  summary?: AISummary | null;
}

export interface StatsResponse {
  total_articles: number;
  categories: Record<string, number>;
  recent_keywords: string[];
  usage: {
    current_model: string;
    total_requests: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    total_estimated_cost_usd: number;
    total_estimated_cost_krw: number;
    usd_to_krw_rate: number;
    input_cost_per_1m: number;
    output_cost_per_1m: number;
  };
  daily_cost: Array<{ date: string; cost_usd: number }>;
}

export interface NewsDateInfo {
  date: string;
  article_count: number;
}

export interface CategoryReport {
  category: string;
  article_count: number;
  average_sentiment: number;
  key_topics: string[];
  executive_summary: string;
}

// ── Strategic Intelligence Report types ──────────────────────────────
export interface ExecutiveSummaryBlock {
  core_message: string;
  keywords: string[];
  sentiment_label: string;
  market_narrative: string;
}

export interface StrategicPillar {
  theme: string;
  situation: string;
  implication: string;
}

export interface HighValueSignal {
  signal_type: string;   // "Critical Risk" | "Opportunity" | "Watch"
  description: string;
  strategic_response: string;
}

export interface ConsultantBriefing {
  insight: string;
  watch_list: string[];
}

export interface StrategicReport {
  executive_summary: ExecutiveSummaryBlock;
  strategic_pillars: StrategicPillar[];
  high_value_signals: HighValueSignal[];
  consultant_briefing: ConsultantBriefing;
}

export interface CategorizedSummaryItem {
  category: string;
  bullets: string[];
}

export interface DailyBriefResponse {
  target_date: string;
  total_articles: number;
  unique_publishers: number;
  average_sentiment: number;
  top_categories: Record<string, number>;
  top_keywords: string[];
  summary_lines: string[];
  categorized_summary?: CategorizedSummaryItem[] | null;
  category_reports: CategoryReport[];
  generated_with_model: boolean;
  strategic_report?: StrategicReport | null;
}

export interface CrawlerResponse {
  status: string;
  new_articles_count: number;
  summarized_count: number;
}

export interface PaginatedNewsResponse {
  items: NewsArticle[];
  total: number;
  skip: number;
  limit: number;
  has_more: boolean;
}

export interface CrawlStatusResponse {
  is_running: boolean;
  target_min_articles: number;
  current_recent_articles: number;
  total_cycles: number;
  total_summarized: number;
  cycle_target_articles: number;
  cycle_processed_articles: number;
  current_phase: string;
  collection_progress_pct: number;
  analysis_progress_pct: number;
  pending_analysis_count: number;
  degraded_summary_count: number;
  started_at?: string | null;
  updated_at?: string | null;
  message: string;
}
