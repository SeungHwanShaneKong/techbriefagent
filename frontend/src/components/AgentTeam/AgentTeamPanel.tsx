import { Clock, Loader2, Send, Star, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { executeAgentTask, fetchAgentHistory, fetchAgentTeam } from "../../api";
import type { AgentExecuteResponse, AgentInfo, AgentTeamResponse } from "../../types";
import AgentCard from "./AgentCard";

const DIVISION_ORDER = ["Planning", "AI Engineering", "Development", "Marketing"];

const divisionLabel: Record<string, string> = {
  Planning: "기획 Division",
  "AI Engineering": "AI 엔지니어링 Division",
  Development: "개발 Division",
  Marketing: "마케팅 Division",
};

const DEFAULT_FAVORITES = [
  "오늘 트렌드 분석",
  "비용 리포트 생성",
  "콘텐츠 전략 제안",
  "수집 품질 점검",
];

const FAVORITES_KEY = "techbriefagent_agent_favorites";

function loadFavorites(): string[] {
  try {
    const saved = localStorage.getItem(FAVORITES_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return DEFAULT_FAVORITES;
}

export default function AgentTeamPanel() {
  const [team, setTeam] = useState<AgentTeamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [taskInput, setTaskInput] = useState("");
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<AgentExecuteResponse | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<AgentExecuteResponse[]>([]);
  const [favorites] = useState<string[]>(loadFavorites);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    Promise.all([fetchAgentTeam(), fetchAgentHistory(20)])
      .then(([teamData, histData]) => {
        setTeam(teamData);
        setHistory(histData);
      })
      .catch(() => setError("에이전트 팀 정보를 불러올 수 없습니다."))
      .finally(() => setLoading(false));
  }, []);

  const handleExecute = useCallback(async (taskOverride?: string) => {
    const task = (taskOverride ?? taskInput).trim();
    if (!task || executing) return;
    setExecuting(true);
    setError("");
    setResult(null);
    try {
      const res = await executeAgentTask({ task });
      setResult(res);
      setHistory((prev) => [res, ...prev].slice(0, 20));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "작업 실행 중 오류가 발생했습니다.";
      setError(msg);
    } finally {
      setExecuting(false);
    }
  }, [taskInput, executing]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
            <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">MECE 에이전트 팀</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {team ? `${team.total_agents}명의 전문 에이전트가 협업합니다` : "로딩 중..."}
            </p>
          </div>
        </div>
      </div>

      {/* Favorite Tasks */}
      <div className="flex flex-wrap gap-1.5">
        <Star className="h-4 w-4 text-yellow-500 mt-0.5" />
        {favorites.map((fav) => (
          <button
            key={fav}
            onClick={() => { setTaskInput(fav); void handleExecute(fav); }}
            disabled={executing}
            className="rounded-full border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 px-3 py-1 text-xs text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors disabled:opacity-50"
          >
            {fav}
          </button>
        ))}
      </div>

      {/* Task Input */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">에이전트 팀에 작업 요청</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleExecute()}
            placeholder="예: 오늘 수집된 뉴스 트렌드를 분석하고 내일 수집 전략을 제안해줘"
            className="flex-1 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200 outline-none transition-colors focus:border-purple-300 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-900/30"
            disabled={executing}
          />
          <button
            onClick={() => handleExecute()}
            disabled={executing || !taskInput.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
          >
            {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            실행
          </button>
        </div>
        {executing && (
          <p className="mt-2 text-xs text-purple-600 dark:text-purple-400">PM 에이전트가 팀을 지휘하여 작업을 수행 중입니다...</p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">실행 결과</h3>
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
              <span>Task: {result.task_id}</span>
              <span>|</span>
              <span>{result.elapsed_ms.toFixed(0)}ms</span>
              <span>|</span>
              <span>${result.total_cost_usd.toFixed(4)}</span>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap gap-1">
            {result.agents_involved.map((id) => (
              <span key={id} className="rounded-md bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-300">
                {id}
              </span>
            ))}
          </div>
          {Object.entries(result.agent_results).map(([agentId, agentResult]) => (
            <details key={agentId} className="mb-2 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                {agentId} — {agentResult.status === "completed" ? "완료" : "오류"} ({agentResult.elapsed_ms.toFixed(0)}ms)
              </summary>
              <div className="px-3 pb-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {agentResult.output}
              </div>
            </details>
          ))}
          <div className="mt-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 p-4">
            <h4 className="mb-2 text-sm font-semibold text-purple-800 dark:text-purple-300">PM 종합 보고서</h4>
            <div className="text-sm leading-relaxed text-purple-900 dark:text-purple-200 whitespace-pre-wrap">
              {result.synthesis}
            </div>
          </div>
        </div>
      )}

      {/* Execution History */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="flex w-full items-center justify-between"
        >
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <Clock className="h-4 w-4 text-primary" /> 실행 이력 ({history.length}건)
          </h3>
          <span className="text-xs text-text-tertiary dark:text-gray-500">{showHistory ? "접기" : "펼치기"}</span>
        </button>
        {showHistory && (
          <div className="mt-3 space-y-2">
            {history.length === 0 ? (
              <p className="text-sm text-text-tertiary dark:text-gray-500 text-center py-4">실행 이력이 없습니다.</p>
            ) : (
              history.map((item) => (
                <details key={item.task_id} className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <summary className="cursor-pointer px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">{item.task_description}</span>
                    <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                      {item.agents_involved.join(", ")} · {item.elapsed_ms.toFixed(0)}ms · ${item.total_cost_usd.toFixed(4)}
                    </span>
                  </summary>
                  <div className="px-3 pb-3 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {item.synthesis}
                  </div>
                </details>
              ))
            )}
          </div>
        )}
      </div>

      {/* PM Agent */}
      {team && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-500 dark:text-gray-400">총괄 PM</h3>
          <AgentCard agent={team.pm} />
        </div>
      )}

      {/* Division Grid */}
      {team &&
        DIVISION_ORDER.map((div) => {
          const agents: AgentInfo[] = team.divisions[div] ?? [];
          if (!agents.length) return null;
          return (
            <div key={div}>
              <h3 className="mb-3 text-sm font-semibold text-gray-500 dark:text-gray-400">{divisionLabel[div] ?? div}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {agents.map((a) => (
                  <AgentCard key={a.agent_id} agent={a} />
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}
