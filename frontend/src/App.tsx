import {
  BarChart3,
  Bookmark,
  CircleAlert,
  Loader2,
  Newspaper,
  TrendingUp,
  Users,
} from "lucide-react";
import dayjs from "dayjs";
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  addBookmark,
  fetchBookmarkedIds,
  fetchCrawlStatus,
  fetchDailyBrief,
  fetchNews,
  fetchNewsDates,
  fetchStats,
  removeBookmarkByArticle,
} from "./api";
import type {
  CrawlStatusResponse,
  DailyBriefResponse,
  NewsArticle,
  NewsDateInfo,
  Notification,
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
import CrawlProgressToast from "./components/common/CrawlProgressToast";

const DailyReportTab = React.lazy(() => import("./components/dashboard/DailyReportTab"));
const AgentTeamPanel = React.lazy(() => import("./components/AgentTeam/AgentTeamPanel"));
const BookmarksTab = React.lazy(() => import("./components/dashboard/BookmarksTab"));
const Chatbot = React.lazy(() => import("./components/Chatbot"));
const AdminPage = React.lazy(() => import("./components/admin/AdminPage"));

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
  const [dailyBrief, setDailyBrief] = useState<DailyBriefResponse>(defaultDailyBrief(dayjs().format("YYYY-MM-DD")));
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const prevRunningRef = useRef<boolean>(false);
  const prevDateRef = useRef<string>(selectedDate);
  const refreshInFlight = useRef<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>(dayjs().format("HH:mm:ss"));

  /* ── Admin page state ── */
  const [adminOpen, setAdminOpen] = useState(false);

  /* ── Bookmarks state ── */
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<number>>(new Set());

  /* ── Notifications state ── */
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notifIdRef = useRef(0);

  function addNotification(type: Notification["type"], message: string) {
    const id = `notif-${notifIdRef.current++}`;
    setNotifications((prev) => [
      { id, type, message, timestamp: new Date().toISOString(), read: false },
      ...prev,
    ].slice(0, 50));
  }

  function clearNotifications() {
    setNotifications([]);
  }

  function dismissNotification(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

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

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

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
  const dateViewInFlight = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(false);

  const categoryRef = useRef(selectedCategory);
  const keywordRef = useRef(keyword);
  categoryRef.current = selectedCategory;
  keywordRef.current = keyword;

  const formatError = useCallback((err: unknown): string => {
    if (!err) return "알 수 없는 오류";
    const axiosErr = err as { response?: { status?: number; data?: { detail?: string } }; code?: string; message?: string };
    const status = axiosErr.response?.status;
    if (status === 400) return axiosErr.response?.data?.detail || "잘못된 요청입니다.";
    if (status === 429) return "서버 요청 한도 초과 – 잠시 후 자동 재시도합니다.";
    if (status === 503 || status === 502) return "API 서버에 연결할 수 없습니다. 서버 상태를 확인해 주세요.";
    if (status && status >= 500) return `서버 내부 오류 (${status}). 잠시 후 다시 시도해 주세요.`;
    if (axiosErr.code === "ECONNABORTED") return "요청 시간 초과 – 네트워크 상태를 확인해 주세요.";
    if (axiosErr.code === "ERR_NETWORK") return "네트워크 연결 실패 – API 서버가 작동 중인지 확인해 주세요.";
    return String(err);
  }, []);

  const loadDateViewsFor = useCallback(async (targetDate: string, signal?: AbortSignal) => {
    if (dateViewInFlight.current) return;
    dateViewInFlight.current = true;
    try {
      const [briefData, articleData] = await Promise.all([
        fetchDailyBrief(targetDate, signal),
        fetchNews({ targetDate, category: categoryRef.current, keyword: keywordRef.current, limit: 180, signal }),
      ]);
      setDailyBrief(briefData);
      setArticles(articleData.items);
    } finally {
      dateViewInFlight.current = false;
    }
  }, []);

  const loadBookmarkedIds = useCallback(async () => {
    try {
      const ids = await fetchBookmarkedIds();
      setBookmarkedIds(new Set(ids));
    } catch { /* ignore */ }
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setError("");
      const [statsData, statusData, datesData] = await Promise.all([
        fetchStats(),
        fetchCrawlStatus(),
        fetchNewsDates(180),
      ]);
      setStats(statsData);
      setCrawlStatus(statusData);
      setNewsDates(datesData);

      let resolvedDate = prevDateRef.current || dayjs().format("YYYY-MM-DD");
      if (datesData.length > 0 && !datesData.some((x) => x.date === resolvedDate)) {
        resolvedDate = datesData[0].date;
        setSelectedDate(resolvedDate);
      }
      if (resolvedDate) {
        prevDateRef.current = resolvedDate;
        await loadDateViewsFor(resolvedDate);
      }
      await loadBookmarkedIds();
    } catch (loadError) {
      const msg = formatError(loadError);
      setError(`데이터 로딩 실패: ${msg}`);
    } finally {
      setLoading(false);
      setLastRefreshed(dayjs().format("HH:mm:ss"));
    }
  }, [loadDateViewsFor, formatError, loadBookmarkedIds]);

  const silentRefresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    try {
      const [statsData, statusData, datesData] = await Promise.all([
        fetchStats(),
        fetchCrawlStatus(),
        fetchNewsDates(180),
      ]);
      setStats(statsData);
      setCrawlStatus(statusData);
      setNewsDates(datesData);

      const curDate = prevDateRef.current;
      if (curDate) {
        await loadDateViewsFor(curDate);
      }
      setLastRefreshed(dayjs().format("HH:mm:ss"));
    } catch {
      /* swallow */
    } finally {
      refreshInFlight.current = false;
    }
  }, [loadDateViewsFor]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      loadAll();
    }
  }, [loadAll]);

  useEffect(() => {
    if (!mountedRef.current) return;
    if (prevDateRef.current === selectedDate) return;
    prevDateRef.current = selectedDate;

    setDailyBrief(defaultDailyBrief(selectedDate));
    setVisibleCount(ARTICLES_PER_PAGE);
    setExpandedArticles(new Set());
    setDateLoading(true);

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    loadDateViewsFor(selectedDate, controller.signal)
      .catch((err) => {
        if (err?.name !== "AbortError" && err?.code !== "ERR_CANCELED") {
          setError(`날짜 데이터 로딩 실패: ${formatError(err)}`);
        }
      })
      .finally(() => setDateLoading(false));
  }, [selectedDate, loadDateViewsFor, formatError]);

  // Detect crawl completion → add notification
  useEffect(() => {
    const prev = prevRunningRef.current;
    const cur = crawlStatus.is_running;
    if (prev && !cur) {
      void loadAll();
      if (crawlStatus.current_phase === "completed") {
        addNotification("crawl_complete", `수집 완료: ${crawlStatus.total_summarized}건 분석`);
      }
    }
    prevRunningRef.current = cur;
  }, [crawlStatus.is_running, crawlStatus.current_phase, crawlStatus.total_summarized, loadAll]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = crawlStatus.is_running ? 3000 : 60000;
    const timer = window.setInterval(() => void silentRefresh(), interval);
    return () => window.clearInterval(timer);
  }, [autoRefresh, silentRefresh, crawlStatus.is_running]);

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
  }, []);

  /* ── Bookmark toggle ── */
  const handleToggleBookmark = useCallback(async (articleId: number) => {
    if (bookmarkedIds.has(articleId)) {
      try {
        await removeBookmarkByArticle(articleId);
        setBookmarkedIds((prev) => { const next = new Set(prev); next.delete(articleId); return next; });
        showToast("북마크가 해제되었습니다");
      } catch {
        showToast("북마크 해제 실패");
      }
    } else {
      try {
        await addBookmark(articleId);
        setBookmarkedIds((prev) => new Set(prev).add(articleId));
        showToast("북마크에 추가되었습니다");
      } catch {
        showToast("북마크 추가 실패");
      }
    }
  }, [bookmarkedIds]);

  /* ═══════════════════════════════════════════════════════════════════
     Loading State
     ═══════════════════════════════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light dark:bg-primary/20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <p className="text-sm font-medium text-text-secondary dark:text-gray-400">대시보드를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════
     Admin Page (full overlay)
     ═══════════════════════════════════════════════════════════════════ */
  if (adminOpen) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <AdminPage onClose={() => setAdminOpen(false)} showToast={showToast} />
        <Toast message={toast} />
      </Suspense>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════════ */
  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-background dark:bg-gray-900 transition-colors">
      <Toast message={toast} />
      <CrawlProgressToast crawlStatus={crawlStatus} />

      <Header
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
        lastRefreshed={lastRefreshed}
        onOpenAdmin={() => setAdminOpen(true)}
        notifications={notifications}
        onClearNotifications={clearNotifications}
        onDismissNotification={dismissNotification}
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
              <TabsList className="dark:bg-gray-800 dark:border-gray-700">
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
                <TabsTrigger value="bookmarks">
                  <Bookmark className="mr-1.5 h-4 w-4" />
                  북마크
                </TabsTrigger>
                <TabsTrigger value="agents">
                  <Users className="mr-1.5 h-4 w-4" />
                  에이전트 팀
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
                  bookmarkedIds={bookmarkedIds}
                  onToggleBookmark={handleToggleBookmark}
                  selectedCategory={selectedCategory}
                />
              </TabsContent>

              <TabsContent value="bookmarks">
                <Suspense fallback={<LoadingFallback />}>
                  <BookmarksTab
                    showToast={showToast}
                    onBookmarkChange={loadBookmarkedIds}
                  />
                </Suspense>
              </TabsContent>

              <TabsContent value="agents">
                <Suspense fallback={<LoadingFallback />}>
                  <AgentTeamPanel />
                </Suspense>
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
