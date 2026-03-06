import dayjs from "dayjs";
import {
  CalendarDays,
  Filter,
  Gauge,
  Loader2,
  RefreshCw,
  Search,
  Wrench,
  X,
} from "lucide-react";

import type { CrawlStatusResponse, NewsDateInfo } from "../../types";
import { CATEGORY_OPTIONS } from "../../constants";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Progress } from "../ui/progress";
import { Separator } from "../ui/separator";

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  crawlStatus: CrawlStatusResponse;
  minArticles: number;
  setMinArticles: (val: number) => void;
  working: boolean;
  handleCrawlStart: () => void;
  handleRepair: () => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  keyword: string;
  setKeyword: (kw: string) => void;
  setSearchKeyword: (kw: string) => void;
  newsDates: NewsDateInfo[];
  loadAll: () => void;
}

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  crawlStatus,
  minArticles,
  setMinArticles,
  working,
  handleCrawlStart,
  handleRepair,
  selectedDate,
  setSelectedDate,
  selectedCategory,
  setSelectedCategory,
  keyword,
  setKeyword,
  setSearchKeyword,
  newsDates,
  loadAll,
}: SidebarProps) {
  return (
    <>
      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto bg-white p-4 shadow-float transition-transform duration-300
          lg:static lg:z-auto lg:col-span-3 lg:w-auto lg:translate-x-0 lg:bg-transparent lg:p-0 lg:shadow-none
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          space-y-5
        `}
      >
        {/* Control Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <Gauge className="h-4 w-4 text-primary" /> 수집/분석 제어
            </CardTitle>
            <CardDescription>최소 목표와 보정 실행을 관리합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">최소 기사 수</label>
              <Input
                type="number"
                min={1}
                max={5000}
                value={minArticles}
                onChange={(e) => setMinArticles(Number(e.target.value))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handleCrawlStart} disabled={working}>
                {working ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
                수집
              </Button>
              <Button onClick={handleRepair} disabled={working} variant="secondary">
                <Wrench className="mr-1.5 h-4 w-4" />
                보정
              </Button>
            </div>
            <Separator />
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-text-secondary">수집 진행률</span>
                  <span className="text-xs font-semibold text-primary">{crawlStatus.collection_progress_pct.toFixed(1)}%</span>
                </div>
                <Progress value={crawlStatus.collection_progress_pct} />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-text-secondary">분석 진행률</span>
                  <span className="text-xs font-semibold text-warning">{crawlStatus.analysis_progress_pct.toFixed(1)}%</span>
                </div>
                <Progress value={crawlStatus.analysis_progress_pct} indicatorClassName="bg-warning" />
              </div>
              <div className="rounded-xl bg-surface p-3 space-y-1">
                <p className="text-xs text-text-secondary">
                  상태: <span className="font-medium text-text-primary">{crawlStatus.current_phase}</span>
                </p>
                <p className="text-xs text-text-secondary">
                  라운드 {crawlStatus.total_cycles} · 분석 {crawlStatus.total_summarized}건
                </p>
                <p className="text-xs text-text-secondary">
                  미분석 {crawlStatus.pending_analysis_count}건 · 모의요약 {crawlStatus.degraded_summary_count}건
                </p>
                <p className="text-[11px] text-text-tertiary mt-1">{crawlStatus.message}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <Filter className="h-4 w-4 text-primary" /> 필터
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">조회 날짜</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={dayjs().format("YYYY-MM-DD")}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">카테고리</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">키워드 검색</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-text-tertiary" />
                <Input
                  className="pl-9 pr-8"
                  placeholder="예: LLM, 반도체, 양자"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
                {keyword && (
                  <button
                    className="absolute right-2.5 top-2.5 rounded-full p-0.5 text-text-tertiary hover:text-primary hover:bg-primary-light transition-colors"
                    onClick={() => { setKeyword(""); setSearchKeyword(""); }}
                    aria-label="키워드 지우기"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => loadAll()}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              전체 새로고침
            </Button>
          </CardContent>
        </Card>

        {/* Date List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <CalendarDays className="h-4 w-4 text-primary" /> 데이터 보유 일자
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {newsDates.length === 0 ? (
              <p className="text-sm text-text-tertiary">수집된 날짜 데이터가 없습니다.</p>
            ) : (
              newsDates.map((item) => (
                <button
                  key={item.date}
                  onClick={() => setSelectedDate(item.date)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
                    selectedDate === item.date
                      ? "border-primary bg-primary-light text-primary font-semibold shadow-sm"
                      : "border-transparent bg-surface text-text-primary hover:bg-gray-100"
                  }`}
                >
                  <span>{item.date}</span>
                  <span className={`text-xs font-medium ${selectedDate === item.date ? "text-primary" : "text-text-tertiary"}`}>
                    {item.article_count}건
                  </span>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </aside>
    </>
  );
}
