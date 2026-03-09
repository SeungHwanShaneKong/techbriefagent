import dayjs from "dayjs";
import { useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Filter,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import type { NewsDateInfo } from "../../types";
import { CATEGORY_OPTIONS } from "../../constants";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
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
  const [datesExpanded, setDatesExpanded] = useState(true);

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
          fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto bg-white dark:bg-gray-900 p-4 shadow-float transition-transform duration-300
          lg:static lg:z-auto lg:col-span-3 lg:w-auto lg:translate-x-0 lg:bg-transparent lg:p-0 lg:shadow-none
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          space-y-5
        `}
      >
        {/* Filters */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[15px] dark:text-gray-200">
              <Filter className="h-4 w-4 text-primary" /> 필터
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary dark:text-gray-400">조회 날짜</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSidebarOpen(false);
                }}
                max={dayjs().format("YYYY-MM-DD")}
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary dark:text-gray-400">카테고리</label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSidebarOpen(false);
                }}
                className="h-10 w-full rounded-xl border border-border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm text-text-primary dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary dark:text-gray-400">키워드 검색</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-text-tertiary dark:text-gray-500" />
                <Input
                  className="pl-9 pr-8 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
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
            <Button variant="outline" className="w-full dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" onClick={() => loadAll()}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              전체 새로고침
            </Button>
          </CardContent>
        </Card>

        {/* Date List */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <button
              onClick={() => setDatesExpanded((v) => !v)}
              className="flex w-full items-center justify-between"
            >
              <CardTitle className="flex items-center gap-2 text-[15px] dark:text-gray-200">
                <CalendarDays className="h-4 w-4 text-primary" /> 데이터 보유 일자
              </CardTitle>
              {datesExpanded ? <ChevronUp className="h-4 w-4 text-text-tertiary" /> : <ChevronDown className="h-4 w-4 text-text-tertiary" />}
            </button>
          </CardHeader>
          {datesExpanded && (
            <CardContent className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {newsDates.length === 0 ? (
                <p className="text-sm text-text-tertiary dark:text-gray-500">수집된 날짜 데이터가 없습니다.</p>
              ) : (
                newsDates.map((item) => (
                  <button
                    key={item.date}
                    onClick={() => {
                      setSelectedDate(item.date);
                      setSidebarOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
                      selectedDate === item.date
                        ? "border-primary bg-primary-light dark:bg-primary/10 text-primary font-semibold shadow-sm"
                        : "border-transparent bg-surface dark:bg-gray-700 text-text-primary dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                    }`}
                  >
                    <span>{item.date}</span>
                    <span className={`text-xs font-medium ${selectedDate === item.date ? "text-primary" : "text-text-tertiary dark:text-gray-500"}`}>
                      {item.article_count}건
                    </span>
                  </button>
                ))
              )}
            </CardContent>
          )}
        </Card>
      </aside>
    </>
  );
}
