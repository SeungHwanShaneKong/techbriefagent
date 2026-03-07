import axios from "axios";
import type {
  CrawlStatusResponse,
  CrawlerResponse,
  DailyBriefResponse,
  NewsDateInfo,
  PaginatedNewsResponse,
  StatsResponse,
} from "./types";

// 프로덕션: "" (Vercel rewrites / 같은 origin)
// 로컬 개발: Vite proxy가 /api/* → localhost:8000 으로 포워딩
// Docker: VITE_API_BASE_URL=http://backend:8000 (빌드 시 주입)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
});

// Retry configuration
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config || config._retryCount >= MAX_RETRIES) {
      return Promise.reject(error);
    }

    const isRetryable =
      !error.response ||
      error.code === "ECONNABORTED" ||
      error.code === "ERR_NETWORK" ||
      (error.response && error.response.status >= 500);

    if (!isRetryable) {
      return Promise.reject(error);
    }

    config._retryCount = (config._retryCount || 0) + 1;
    const delay = RETRY_DELAY_MS * config._retryCount;
    await sleep(delay);
    return api(config);
  },
);

export async function fetchStats(signal?: AbortSignal) {
  const { data } = await api.get<StatsResponse>("/api/stats", { signal });
  return data;
}

export async function fetchNewsDates(limit = 90, signal?: AbortSignal) {
  const { data } = await api.get<NewsDateInfo[]>("/api/news-dates", { params: { limit }, signal });
  return data;
}

export async function fetchNews(params: {
  targetDate?: string;
  category?: string;
  keyword?: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<PaginatedNewsResponse> {
  const query: Record<string, string | number> = {
    limit: params.limit ?? 120,
  };
  if (params.targetDate) query.target_date = params.targetDate;
  if (params.category && params.category !== "All") query.category = params.category;
  if (params.keyword) query.keyword = params.keyword;

  const { data } = await api.get<PaginatedNewsResponse>("/api/news", {
    params: query,
    signal: params.signal
  });
  return data;
}

export async function fetchDailyBrief(targetDate: string, signal?: AbortSignal) {
  const { data } = await api.get<DailyBriefResponse>("/api/daily-brief", {
    params: { target_date: targetDate },
    signal,
  });
  return data;
}

export async function fetchCrawlStatus(signal?: AbortSignal) {
  const { data } = await api.get<CrawlStatusResponse>("/api/crawl-status", { signal });
  return data;
}

export async function triggerCrawl(minArticles: number) {
  const { data } = await api.post<CrawlerResponse>("/api/crawl", null, {
    params: { min_articles: minArticles },
  });
  return data;
}

export async function triggerRepair() {
  const { data } = await api.post<CrawlerResponse>("/api/repair-analysis");
  return data;
}

// ── Chatbot API ──
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatbotResponse {
  answer: string;
  source_count: number;
  generated_with_model: boolean;
}

export async function sendChatbotMessage(
  question: string,
  history: ChatMessage[] = [],
): Promise<ChatbotResponse> {
  const { data } = await api.post<ChatbotResponse>("/api/chatbot", {
    question,
    history,
  });
  return data;
}

export { API_BASE_URL };
