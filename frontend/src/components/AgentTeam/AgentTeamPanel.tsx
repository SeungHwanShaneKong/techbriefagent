import { Loader2, Send, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { executeAgentTask, fetchAgentTeam } from "../../api";
import type { AgentExecuteResponse, AgentInfo, AgentTeamResponse } from "../../types";
import AgentCard from "./AgentCard";

const DIVISION_ORDER = ["Planning", "AI Engineering", "Development", "Marketing"];

const divisionLabel: Record<string, string> = {
  Planning: "기획 Division",
  "AI Engineering": "AI 엔지니어링 Division",
  Development: "개발 Division",
  Marketing: "마케팅 Division",
};

export default function AgentTeamPanel() {
  const [team, setTeam] = useState<AgentTeamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [taskInput, setTaskInput] = useState("");
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<AgentExecuteResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAgentTeam()
      .then(setTeam)
      .catch(() => setError("에이전트 팀 정보를 불러올 수 없습니다."))
      .finally(() => setLoading(false));
  }, []);

  const handleExecute = useCallback(async () => {
    if (!taskInput.trim() || executing) return;
    setExecuting(true);
    setError("");
    setResult(null);
    try {
      const res = await executeAgentTask({ task: taskInput.trim() });
      setResult(res);
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
      <div className="rounded-2xl bg-gradient-to-r from-purple-50 to-blue-50 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
            <Users className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">MECE 에이전트 팀</h2>
            <p className="text-sm text-gray-500">
              {team ? `${team.total_agents}명의 전문 에이전트가 협업합니다` : "로딩 중..."}
            </p>
          </div>
        </div>
      </div>

      {/* Task Input */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">에이전트 팀에 작업 요청</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleExecute()}
            placeholder="예: 오늘 수집된 뉴스 트렌드를 분석하고 내일 수집 전략을 제안해줘"
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
            disabled={executing}
          />
          <button
            onClick={handleExecute}
            disabled={executing || !taskInput.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
          >
            {executing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            실행
          </button>
        </div>
        {executing && (
          <p className="mt-2 text-xs text-purple-600">
            PM 에이전트가 팀을 지휘하여 작업을 수행 중입니다...
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">실행 결과</h3>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>Task: {result.task_id}</span>
              <span>|</span>
              <span>{result.elapsed_ms.toFixed(0)}ms</span>
              <span>|</span>
              <span>${result.total_cost_usd.toFixed(4)}</span>
            </div>
          </div>

          {/* Involved agents */}
          <div className="mb-3 flex flex-wrap gap-1">
            {result.agents_involved.map((id) => (
              <span key={id} className="rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                {id}
              </span>
            ))}
          </div>

          {/* Per-agent results */}
          {Object.entries(result.agent_results).map(([agentId, agentResult]) => (
            <details key={agentId} className="mb-2 rounded-lg border border-gray-100 bg-gray-50">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-700">
                {agentId} — {agentResult.status === "completed" ? "완료" : "오류"} ({agentResult.elapsed_ms.toFixed(0)}ms)
              </summary>
              <div className="px-3 pb-3 text-sm leading-relaxed text-gray-600 whitespace-pre-wrap">
                {agentResult.output}
              </div>
            </details>
          ))}

          {/* Synthesis */}
          <div className="mt-4 rounded-xl bg-purple-50 p-4">
            <h4 className="mb-2 text-sm font-semibold text-purple-800">PM 종합 보고서</h4>
            <div className="text-sm leading-relaxed text-purple-900 whitespace-pre-wrap">
              {result.synthesis}
            </div>
          </div>
        </div>
      )}

      {/* PM Agent */}
      {team && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-500">총괄 PM</h3>
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
              <h3 className="mb-3 text-sm font-semibold text-gray-500">{divisionLabel[div] ?? div}</h3>
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
