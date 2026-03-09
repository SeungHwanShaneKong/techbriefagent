import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Database,
  Gauge,
  Loader2,
  Plus,
  RefreshCw,
  Rss,
  Settings,
  Trash2,
  Wrench,
  X,
} from "lucide-react";

import type { AdminConfig, AdminLogEntry, FeedInfo } from "../../types";
import {
  fetchAdminConfig,
  fetchAdminFeeds,
  fetchAdminLogs,
  addAdminFeed,
  removeAdminFeed,
  updateAdminConfig,
  triggerCrawl,
  triggerRepair,
  fetchCrawlStatus,
} from "../../api";
import type { CrawlStatusResponse } from "../../types";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Progress } from "../ui/progress";

interface AdminPageProps {
  onClose: () => void;
  showToast: (msg: string) => void;
}

export default function AdminPage({ onClose, showToast }: AdminPageProps) {
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [feeds, setFeeds] = useState<FeedInfo[]>([]);
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(0);
  const [loading, setLoading] = useState(true);

  // Crawl control state
  const [crawlStatus, setCrawlStatus] = useState<CrawlStatusResponse | null>(null);
  const [minArticles, setMinArticles] = useState(30);
  const [working, setWorking] = useState(false);

  // New feed form
  const [newFeedName, setNewFeedName] = useState("");
  const [newFeedUrl, setNewFeedUrl] = useState("");

  // Config edit
  const [editCrawlRate, setEditCrawlRate] = useState(30);
  const [editChatbotRate, setEditChatbotRate] = useState(2);
  const [editBriefRate, setEditBriefRate] = useState(2);

  const loadData = useCallback(async () => {
    try {
      const [configData, feedsData, logsData, statusData] = await Promise.all([
        fetchAdminConfig(),
        fetchAdminFeeds(),
        fetchAdminLogs(logPage * 20, 20),
        fetchCrawlStatus(),
      ]);
      setConfig(configData);
      setFeeds(feedsData);
      setLogs(logsData.items);
      setLogTotal(logsData.total);
      setCrawlStatus(statusData);
      setEditCrawlRate(configData.crawl_rate_limit_seconds);
      setEditChatbotRate(configData.chatbot_rate_limit_seconds);
      setEditBriefRate(configData.brief_rate_limit_seconds);
    } catch {
      showToast("관리자 데이터 로딩 실패");
    } finally {
      setLoading(false);
    }
  }, [logPage, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Crawl status polling
  useEffect(() => {
    if (!crawlStatus?.is_running) return;
    const timer = setInterval(async () => {
      try {
        const st = await fetchCrawlStatus();
        setCrawlStatus(st);
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(timer);
  }, [crawlStatus?.is_running]);

  async function handleAddFeed() {
    if (!newFeedName.trim() || !newFeedUrl.trim()) return;
    try {
      await addAdminFeed(newFeedName.trim(), newFeedUrl.trim());
      setNewFeedName("");
      setNewFeedUrl("");
      const updated = await fetchAdminFeeds();
      setFeeds(updated);
      showToast(`피드 "${newFeedName}" 추가 완료`);
    } catch {
      showToast("피드 추가 실패");
    }
  }

  async function handleRemoveFeed(name: string) {
    try {
      await removeAdminFeed(name);
      const updated = await fetchAdminFeeds();
      setFeeds(updated);
      showToast(`피드 "${name}" 제거 완료`);
    } catch {
      showToast("피드 제거 실패");
    }
  }

  async function handleSaveConfig() {
    try {
      await updateAdminConfig({
        crawl_rate_limit_seconds: editCrawlRate,
        chatbot_rate_limit_seconds: editChatbotRate,
        brief_rate_limit_seconds: editBriefRate,
      });
      showToast("설정 저장 완료");
    } catch {
      showToast("설정 저장 실패");
    }
  }

  async function handleCrawlStart() {
    setWorking(true);
    try {
      await triggerCrawl(minArticles);
      const st = await fetchCrawlStatus();
      setCrawlStatus(st);
      showToast("크롤링 시작");
    } catch {
      showToast("크롤링 시작 실패");
    } finally {
      setWorking(false);
    }
  }

  async function handleRepair() {
    setWorking(true);
    try {
      await triggerRepair();
      const st = await fetchCrawlStatus();
      setCrawlStatus(st);
      showToast("분석 보정 시작");
    } catch {
      showToast("보정 실패");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface dark:bg-gray-800 text-text-secondary hover:text-primary transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold text-text-primary dark:text-gray-100">관리자 페이지</h1>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl text-text-secondary hover:text-primary transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-6 px-5 py-6">
        {/* Crawl Control Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <Gauge className="h-4 w-4 text-primary" /> 수집/분석 제어
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-secondary dark:text-gray-400">최소 기사 수</label>
                <Input type="number" min={1} max={5000} value={minArticles} onChange={(e) => setMinArticles(Number(e.target.value))} />
              </div>
              <Button onClick={handleCrawlStart} disabled={working || crawlStatus?.is_running} className="self-end">
                {working ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
                수집 시작
              </Button>
              <Button onClick={handleRepair} disabled={working || crawlStatus?.is_running} variant="secondary" className="self-end">
                <Wrench className="mr-1.5 h-4 w-4" /> 분석 보정
              </Button>
            </div>
            {crawlStatus && (
              <div className="space-y-3 rounded-xl bg-surface dark:bg-gray-800 p-4">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-text-secondary dark:text-gray-400">수집 진행률</span>
                    <span className="text-xs font-semibold text-primary">{crawlStatus.collection_progress_pct.toFixed(1)}%</span>
                  </div>
                  <Progress value={crawlStatus.collection_progress_pct} />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-text-secondary dark:text-gray-400">분석 진행률</span>
                    <span className="text-xs font-semibold text-warning">{crawlStatus.analysis_progress_pct.toFixed(1)}%</span>
                  </div>
                  <Progress value={crawlStatus.analysis_progress_pct} indicatorClassName="bg-warning" />
                </div>
                <p className="text-xs text-text-secondary dark:text-gray-400">
                  상태: <span className="font-medium text-text-primary dark:text-gray-200">{crawlStatus.current_phase}</span>
                  {" · "}라운드 {crawlStatus.total_cycles} · 분석 {crawlStatus.total_summarized}건
                  {" · "}미분석 {crawlStatus.pending_analysis_count}건 · 모의요약 {crawlStatus.degraded_summary_count}건
                </p>
                <p className="text-[11px] text-text-tertiary dark:text-gray-500">{crawlStatus.message}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* RSS Feed Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <Rss className="h-4 w-4 text-primary" /> RSS 피드 관리
              <span className="ml-auto text-xs font-normal text-text-tertiary dark:text-gray-500">{feeds.length}개</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add feed form */}
            <div className="flex gap-2">
              <Input placeholder="피드 이름" value={newFeedName} onChange={(e) => setNewFeedName(e.target.value)} className="flex-1" />
              <Input placeholder="RSS URL" value={newFeedUrl} onChange={(e) => setNewFeedUrl(e.target.value)} className="flex-[2]" />
              <Button onClick={handleAddFeed} disabled={!newFeedName.trim() || !newFeedUrl.trim()}>
                <Plus className="mr-1 h-4 w-4" /> 추가
              </Button>
            </div>

            {/* Feed list */}
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {feeds.map((feed) => (
                <div key={feed.name} className="flex items-center justify-between rounded-lg bg-surface dark:bg-gray-800 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-text-primary dark:text-gray-200">{feed.name}</span>
                    <p className="truncate text-xs text-text-tertiary dark:text-gray-500">{feed.url}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveFeed(feed.name)}
                    className="ml-2 rounded-lg p-1.5 text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <Settings className="h-4 w-4 text-primary" /> 시스템 설정
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-secondary dark:text-gray-400">수집 Rate Limit (초)</label>
                <Input type="number" min={1} max={300} value={editCrawlRate} onChange={(e) => setEditCrawlRate(Number(e.target.value))} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-secondary dark:text-gray-400">챗봇 Rate Limit (초)</label>
                <Input type="number" min={1} max={60} value={editChatbotRate} onChange={(e) => setEditChatbotRate(Number(e.target.value))} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-secondary dark:text-gray-400">브리핑 Rate Limit (초)</label>
                <Input type="number" min={1} max={60} value={editBriefRate} onChange={(e) => setEditBriefRate(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-surface dark:bg-gray-800 px-3 py-2 text-xs text-text-secondary dark:text-gray-400">
                현재 모델: <span className="font-semibold text-text-primary dark:text-gray-200">{config?.current_model}</span>
              </div>
              <Button onClick={handleSaveConfig} variant="outline">설정 저장</Button>
            </div>
          </CardContent>
        </Card>

        {/* LLM Usage Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <Database className="h-4 w-4 text-primary" /> LLM 사용 로그
              <span className="ml-auto text-xs font-normal text-text-tertiary dark:text-gray-500">총 {logTotal}건</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-text-tertiary dark:text-gray-500">
                    <th className="pb-2 pr-4">ID</th>
                    <th className="pb-2 pr-4">모델</th>
                    <th className="pb-2 pr-4">프롬프트</th>
                    <th className="pb-2 pr-4">응답</th>
                    <th className="pb-2 pr-4">토큰</th>
                    <th className="pb-2 pr-4">비용($)</th>
                    <th className="pb-2">일시</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-border/50 text-text-primary dark:text-gray-300">
                      <td className="py-2 pr-4">{log.id}</td>
                      <td className="py-2 pr-4">{log.model_name}</td>
                      <td className="py-2 pr-4">{log.prompt_tokens.toLocaleString()}</td>
                      <td className="py-2 pr-4">{log.completion_tokens.toLocaleString()}</td>
                      <td className="py-2 pr-4">{log.total_tokens.toLocaleString()}</td>
                      <td className="py-2 pr-4">${log.estimated_cost_usd.toFixed(6)}</td>
                      <td className="py-2">{log.created_at ? new Date(log.created_at).toLocaleString("ko-KR") : "-"}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-text-tertiary dark:text-gray-500">로그 데이터가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {logTotal > 20 && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" disabled={logPage === 0} onClick={() => setLogPage((p) => p - 1)}>이전</Button>
                <span className="text-xs text-text-secondary dark:text-gray-400">{logPage + 1} / {Math.ceil(logTotal / 20)}</span>
                <Button variant="outline" size="sm" disabled={(logPage + 1) * 20 >= logTotal} onClick={() => setLogPage((p) => p + 1)}>다음</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
