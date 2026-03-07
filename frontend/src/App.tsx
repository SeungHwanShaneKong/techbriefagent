import {
  BarChart3,
  CircleAlert,
  Loader2,
  Newspaper,
  TrendingUp,
} from "lucide-react";
import dayjs from "dayjs";
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  fetchCrawlStatus,
  fetchDailyBrief,
  fetchNews,
  fetchNewsDates,
  fetchStats,
  triggerCrawl,
  triggerRepair,
} from "./api";
import type {
  CrawlStatusResponse,
  DailyBriefResponse,
  NewsArticle,
  NewsDateInfo,
  StatsResponse,
} from "./types";
import {
  categoryColor,
  categoryLabel,
  defaultCrawlStatus,
  defaultDailyBrief,
  defaultStats,
} from "./constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import Toast from "./components/common/Toast";
import ErrorBoundary from "./components/common/ErrorBoundary";
import Header from "./components/layout/Header";
import Sidebar from "./components/layout/Sidebar";
import StatCards from "./components/dashboard/StatCards";
import OverviewTab from "./components/dashboard/OverviewTab";
import ArticlesTab from "./components/dashboard/ArticlesTab";

const DailyReportTab = React.lazy(() => import("./components/dashboard/DailyReportTab"));
const Chatbot = React.lazy(() => import("./components/Chatbot"));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Main App
   ═══════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [stats, setStats] = useState<StatsResponse>(defaultStats());
  const [crawlStatus, setCrawlStatus] = useState<CrawlStatusResponse>(defaultCrawlStatus());
  const [newsDates, setNewsDates] = useState<NewsDateInfo[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [keyword, setKeyword] = useState<string>("");
  const [minArticles, setMinArticles] = useState<number>(30);
  const [dailyBrief, setDailyBrief] = useState<DailyBriefResponse>(defaultDailyBrief(dayjs().format("YYYY-MM-DD")));
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [working, setWorking] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const prevRunningRef = useRef<boolean>(false);
  const prevDateRef = useRef<string>(selectedDate);
  const refreshInFlight = useRef<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>(dayjs().format("HH:mm:ss"));

  /* ── UX#1: Pagination state ── */
  const ARTICLES_PER_PAGE = 20;
  const [visibleCount, setVisibleCount] = useState<number>(ARTICLES_PER_PAGE);

  /* ── UX#2: Date-change loading indicator ── */
  const [dateLoading, setDateLoading] = useState<boolean>(false);

  /* ── UX#3: Accordion expanded article IDs ── */
  const [expandedArticles, setExpandedArticles] = useState<Set<number>>(new Set());

  /* ── UX#4: Mobile sidebar toggle ── */
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  /* ── UX#5: Toast notification ── */
  const [toast, setToast] = useState<string>("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  }

  /** UX#5: Set keyword filter from any clickable keyword chip */
  function setSearchKeyword(kw: string) {
    setKeyword(kw);
  }

  /* ── UX#1: Infinite scroll sentinel ── */
  const sentinelRef = useRef<HTMLDivElement>(null);

  /* ── derived data ── */
  const keywordTrend = useMemo(() => {
    const map = new Map<string, number>();
    for (const keywordItem of stats.recent_keywords || []) {
      const key = String(keywordItem || "").trim();
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, count]) => ({ name, count }));
  }, [stats.recent_keywords]);

  const categoryChartData = useMemo(
    () =>
      Object.entries(stats.categories || {}).map(([name, count]) => ({
        name: categoryLabel(name),
        count,
        fill: categoryColor(name),
      })),
    [stats.categories]
  );

  const categoryReportData = useMemo(
    () =>
      (dailyBrief.category_reports || []).map((item) => ({
        ...item,
        categoryLabel: categoryLabel(item.category),
      })),
    [dailyBrief.category_reports]
  );

  /* ── data fetching ── */
  const loadCore = useCallback(async () => {
    const [statsData, statusData, datesData] = await Promise.all([fetchStats(), fetchCrawlStatus(), fetchNewsDates(180)]);
    setStats(statsData);
    setCrawlStatus(statusData);
    setNewsDates(datesData);
    if (datesData.length > 0 && !datesData.some((x) => x.date === selectedDate)) {
      setSelectedDate(datesData[0].date);
    }
  }, [selectedDate]);

  const loadDateViews = useCallback(async (signal?: AbortSignal) => {
    const [briefData, articleData] = await Promise.all([
      fetchDailyBrief(selectedDate, signal),
      fetchNews({ targetDate: selectedDate, category: selectedCategory, keyword, limit: 180, signal }),
    ]);
    setDailyBrief(briefData);
    setArticles(articleData.items);
  }, [selectedDate, selectedCategory, keyword]);

  const loadAll = useCallback(async () => {
    try {
      setError("");
      await loadCore();
      await loadDateViews();
    } catch (loadError) {
      setError(`데이터 로딩 실패: ${String(loadError)}`);
    } finally {
      setLoading(false);
      setLastRefreshed(dayjs().format("HH:mm:ss"));
    }
  }, [loadCore, loadDateViews]);

  const silentRefresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    try {
      await loadCore();
      await loadDateViews();
      setLastRefreshed(dayjs().format("HH:mm:ss"));
    } catch {
      /* swallow */
    } finally {
      refreshInFlight.current = false;
    }
  }, [loadCore, loadDateViews]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (prevDateRef.current !== selectedDate) {
      prevDateRef.current = selectedDate;
      setDailyBrief(defaultDailyBrief(selectedDate));
      setVisibleCount(ARTICLES_PER_PAGE);
      setExpandedArticles(new Set());
      setDateLoading(true);

      // Cancel previous in-flight request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      loadDateViews(controller.signal)
        .catch((err) => {
          if (err?.name !== "AbortError" && err?.code !== "ERR_CANCELED") {
            console.error("loadDateViews error:", err);
          }
        })
        .finally(() => setDateLoading(false));
    }
  }, [loadDateViews, selectedDate]);

  useEffect(() => {
    const prev = prevRunningRef.current;
    const cur = crawlStatus.is_running;
    if (prev && !cur) void loadAll();
    prevRunningRef.current = cur;
  }, [crawlStatus.is_running, loadAll]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = crawlStatus.is_running ? 3000 : 60000;
    const timer = window.setInterval(() => void silentRefresh(), interval);
    return () => window.clearInterval(timer);
  }, [autoRefresh, silentRefresh, crawlStatus.is_running]);

  /* ── UX#1: IntersectionObserver for infinite scroll ── */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => prev + ARTICLES_PER_PAGE);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [articles.length]);

  /* ── actions ── */
  async function handleCrawlStart() {
    setWorking(true);
    try {
      const response = await triggerCrawl(minArticles);
      setError("");
      showToast(response.status);
      await loadCore();
    } catch (e) {
      setError(`수집 실행 실패: ${String(e)}`);
    } finally {
      setWorking(false);
    }
  }

  async function handleRepair() {
    setWorking(true);
    try {
      const response = await triggerRepair();
      setError("");
      showToast(response.status);
      await loadCore();
    } catch (e) {
      setError(`분석 보정 실행 실패: ${String(e)}`);
    } finally {
      setWorking(false);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     Loading State
     ═══════════════════════════════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <p className="text-sm font-medium text-text-secondary">대시보드를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════════ */
  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-background">
      <Toast message={toast} />

      <Header
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
        lastRefreshed={lastRefreshed}
      />

      <div className="mx-auto max-w-[1600px] px-5 py-6 lg:px-8">
        {/* Error Banner */}
        {error && (
          <div className="mb-5 flex items-center gap-2.5 rounded-2xl border border-danger/20 bg-danger/5 px-5 py-3.5 text-sm text-danger">
            <CircleAlert className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <StatCards stats={stats} />

        <div className="grid gap-6 lg:grid-cols-12">
          <Sidebar
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            crawlStatus={crawlStatus}
            minArticles={minArticles}
            setMinArticles={setMinArticles}
            working={working}
            handleCrawlStart={handleCrawlStart}
            handleRepair={handleRepair}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            keyword={keyword}
            setKeyword={setKeyword}
            setSearchKeyword={setSearchKeyword}
            newsDates={newsDates}
            loadAll={() => void loadAll()}
          />

          <main className="space-y-5 lg:col-span-9">
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">
                  <TrendingUp className="mr-1.5 h-4 w-4" />
                  운영 현황
                </TabsTrigger>
                <TabsTrigger value="daily">
                  <BarChart3 className="mr-1.5 h-4 w-4" />
                  일일 리포트
                </TabsTrigger>
                <TabsTrigger value="articles">
                  <Newspaper className="mr-1.5 h-4 w-4" />
                  기사 분석
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <OverviewTab
                  categoryChartData={categoryChartData}
                  costData={stats.daily_cost}
                  keywordTrend={keywordTrend}
                  setSearchKeyword={setSearchKeyword}
                  showToast={showToast}
                />
              </TabsContent>

              <TabsContent value="daily">
                <Suspense fallback={<LoadingFallback />}>
                  <DailyReportTab
                    dailyBrief={dailyBrief}
                    selectedDate={selectedDate}
                    categoryReportData={categoryReportData}
                  />
                </Suspense>
              </TabsContent>

              <TabsContent value="articles">
                <ArticlesTab
                  articles={articles}
                  selectedDate={selectedDate}
                  dateLoading={dateLoading}
                  visibleCount={visibleCount}
                  expandedArticles={expandedArticles}
                  setExpandedArticles={setExpandedArticles}
                  sentinelRef={sentinelRef}
                  setSearchKeyword={setSearchKeyword}
                  showToast={showToast}
                />
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>

      <Suspense fallback={null}>
        <Chatbot />
      </Suspense>
    </div>
    </ErrorBoundary>
  );
}
