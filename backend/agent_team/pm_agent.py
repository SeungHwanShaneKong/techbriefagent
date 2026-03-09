"""
PM-1: 프로젝트 매니저 (Project Commander) – orchestrates the full MECE agent team.
Patch ID: AGENT-TEAM-20260309-074000
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from typing import Any, Dict, List, Optional

from .base import AgentContext, AgentResult, AgentTask, BaseAgent
from .registry import AGENT_REGISTRY, DIVISIONS, get_agent
from ..llm_service import (
    build_usage_payload,
    estimate_cost_usd,
    extract_usage_from_response,
    get_model_name,
    get_openai_client,
)
from ..logging_config import llm_logger as logger


# ── Global state for the agent team (mirrors CRAWL_JOB_STATE pattern) ─
AGENT_TEAM_STATE: Dict[str, Any] = {
    "is_running": False,
    "current_task_id": None,
    "agents_involved": [],
    "progress": [],
    "last_result": None,
}

# In-memory task history (last 50 tasks)
AGENT_TASK_HISTORY: List[Dict[str, Any]] = []
MAX_HISTORY = 50


class PMAgent(BaseAgent):
    """
    PM-1: Project Commander.
    Analyzes incoming requests, selects relevant agents, executes them,
    and synthesizes a unified response.
    """

    agent_id = "PM-1"
    name_ko = "프로젝트 매니저"
    name_en = "Project Commander"
    division = "PM"
    role_description = "전체 에이전트 팀 지휘, 작업 분배, 결과 종합, 의사결정"
    capabilities = [
        "작업 요청 분석 및 에이전트 선택",
        "순차/병렬 실행 계획 수립",
        "결과 종합 및 최종 보고서 생성",
        "팀 성과 모니터링",
    ]
    system_prompt = (
        "당신은 'PM-1 프로젝트 매니저'로, 13개 에이전트로 구성된 MECE 팀을 지휘합니다.\n\n"
        "【팀 구성】\n"
        "기획 Division: PL-1(전략기획자), PL-2(콘텐츠전략가), PL-3(리소스플래너)\n"
        "AI엔지니어링 Division: AE-1(프롬프트엔지니어), AE-2(모델성능분석가), AE-3(파이프라인엔지니어)\n"
        "개발 Division: DV-1(백엔드아키텍트), DV-2(프론트엔드아키텍트), DV-3(인프라엔지니어)\n"
        "마케팅 Division: MK-1(콘텐츠마케터), MK-2(사용자분석가), MK-3(브랜드커뮤니케이터)\n\n"
        "【역할】\n"
        "사용자의 요청을 분석하여 어떤 에이전트를 투입할지 결정하고,\n"
        "각 에이전트의 결과를 종합하여 최종 보고서를 작성합니다.\n\n"
        "요청 분석 시 아래 JSON 형식으로 응답하세요:\n"
        '{"selected_agents": ["PL-1", "AE-2"], "reason": "선택 이유", "execution_order": "parallel"}\n'
        "execution_order는 'parallel' 또는 'sequential' 중 선택합니다."
    )

    async def orchestrate(
        self,
        task_description: str,
        context: AgentContext,
        target_agents: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Full orchestration pipeline:
        1. Analyze request → select agents (or use target_agents)
        2. Execute selected agents (parallel or sequential)
        3. Synthesize results into a final report
        """
        task_id = uuid.uuid4().hex[:12]
        start_time = time.monotonic()

        # Update global state
        AGENT_TEAM_STATE["is_running"] = True
        AGENT_TEAM_STATE["current_task_id"] = task_id
        AGENT_TEAM_STATE["progress"] = []

        try:
            # Step 1: Select agents
            if target_agents:
                selected_ids = [aid for aid in target_agents if aid in AGENT_REGISTRY]
                execution_order = "parallel"
                selection_reason = f"사용자가 직접 지정: {', '.join(selected_ids)}"
            else:
                selection = await self._select_agents(task_description, context)
                selected_ids = selection.get("selected_agents", [])
                execution_order = selection.get("execution_order", "parallel")
                selection_reason = selection.get("reason", "")

            if not selected_ids:
                selected_ids = ["PL-1"]  # Fallback to strategic planner

            AGENT_TEAM_STATE["agents_involved"] = selected_ids
            _log_progress(task_id, f"에이전트 선택 완료: {', '.join(selected_ids)} ({execution_order})")

            # Step 2: Execute agents
            task = AgentTask(
                task_id=task_id,
                description=task_description,
                requesting_agent="PM-1",
            )
            results = await self._execute_agents(selected_ids, task, context, execution_order)
            _log_progress(task_id, f"에이전트 실행 완료: {len(results)}개 결과 수신")

            # Step 3: Synthesize
            synthesis = await self._synthesize(task_description, results, context)
            _log_progress(task_id, "최종 보고서 생성 완료")

            elapsed_ms = round((time.monotonic() - start_time) * 1000, 1)

            # Calculate total cost
            total_cost = 0.0
            for r in results:
                total_cost += r.usage.get("estimated_cost_usd", 0.0)
            total_cost += synthesis.get("usage", {}).get("estimated_cost_usd", 0.0)

            final = {
                "task_id": task_id,
                "status": "completed",
                "task_description": task_description,
                "agents_involved": selected_ids,
                "selection_reason": selection_reason,
                "agent_results": {r.agent_id: {"output": r.output, "status": r.status, "elapsed_ms": r.elapsed_ms} for r in results},
                "synthesis": synthesis.get("output", ""),
                "total_cost_usd": round(total_cost, 6),
                "elapsed_ms": elapsed_ms,
            }

            # Store in history
            _store_history(final)
            AGENT_TEAM_STATE["last_result"] = final
            return final

        except Exception as e:
            logger.error("[PM-1] orchestration error: %s", e, exc_info=True)
            elapsed_ms = round((time.monotonic() - start_time) * 1000, 1)
            error_result = {
                "task_id": task_id,
                "status": "error",
                "task_description": task_description,
                "agents_involved": [],
                "selection_reason": "",
                "agent_results": {},
                "synthesis": f"오케스트레이션 오류: {str(e)}",
                "total_cost_usd": 0.0,
                "elapsed_ms": elapsed_ms,
            }
            _store_history(error_result)
            return error_result
        finally:
            AGENT_TEAM_STATE["is_running"] = False
            AGENT_TEAM_STATE["current_task_id"] = None

    async def _select_agents(self, task_description: str, context: AgentContext) -> Dict[str, Any]:
        """Use LLM to analyze the task and select the best agents."""
        agent_list = "\n".join(
            f"- {a.agent_id}: {a.name_ko} ({a.division}) - {a.role_description}"
            for a in AGENT_REGISTRY.values()
        )
        prompt = (
            f"아래 작업에 가장 적합한 에이전트를 선택하세요.\n\n"
            f"【작업】\n{task_description}\n\n"
            f"【가용 에이전트】\n{agent_list}\n\n"
            "1~4개 에이전트를 선택하고, JSON으로 응답하세요:\n"
            '{"selected_agents": ["ID1", "ID2"], "reason": "이유", "execution_order": "parallel|sequential"}'
        )
        output, usage = await self._call_llm(prompt, max_tokens=500)

        try:
            # Try to parse JSON from the output
            # Handle case where LLM wraps JSON in markdown code blocks
            cleaned = output.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            parsed = json.loads(cleaned)
            # Validate agent IDs
            valid_ids = [aid for aid in parsed.get("selected_agents", []) if aid in AGENT_REGISTRY]
            return {
                "selected_agents": valid_ids or ["PL-1"],
                "reason": parsed.get("reason", ""),
                "execution_order": parsed.get("execution_order", "parallel"),
            }
        except (json.JSONDecodeError, KeyError):
            logger.warning("[PM-1] Failed to parse agent selection, using fallback")
            return {
                "selected_agents": ["PL-1", "AE-2"],
                "reason": "JSON 파싱 실패로 기본 에이전트 선택",
                "execution_order": "parallel",
            }

    async def _execute_agents(
        self,
        agent_ids: List[str],
        task: AgentTask,
        context: AgentContext,
        execution_order: str,
    ) -> List[AgentResult]:
        """Execute selected agents in parallel or sequential order."""
        results: List[AgentResult] = []

        if execution_order == "sequential":
            for aid in agent_ids:
                agent = get_agent(aid)
                if agent:
                    _log_progress(task.task_id, f"{agent.name_ko}({aid}) 실행 중...")
                    result = await agent.execute(task, context)
                    results.append(result)
                    # Pass previous results as context for next agent
                    task.context["previous_results"] = {r.agent_id: r.output for r in results}
        else:
            # Parallel execution
            async def _run(aid: str) -> Optional[AgentResult]:
                agent = get_agent(aid)
                if agent:
                    _log_progress(task.task_id, f"{agent.name_ko}({aid}) 실행 중...")
                    return await agent.execute(task, context)
                return None

            raw_results = await asyncio.gather(*[_run(aid) for aid in agent_ids])
            results = [r for r in raw_results if r is not None]

        return results

    async def _synthesize(
        self,
        task_description: str,
        results: List[AgentResult],
        context: AgentContext,
    ) -> Dict[str, Any]:
        """Synthesize agent results into a unified final report."""
        if not results:
            return {"output": "실행된 에이전트가 없습니다.", "usage": {}}

        result_summaries = []
        for r in results:
            status_icon = "O" if r.status == "completed" else "X"
            result_summaries.append(
                f"[{status_icon}] {r.agent_id} ({r.agent_name}): {r.output[:500]}"
            )

        synthesis_prompt = (
            f"당신은 PM으로서 아래 에이전트들의 분석 결과를 종합하여 최종 보고서를 작성합니다.\n\n"
            f"【원래 작업】\n{task_description}\n\n"
            f"【에이전트 분석 결과】\n" + "\n\n".join(result_summaries) + "\n\n"
            "위 결과를 종합하여 다음을 포함하는 최종 보고서를 한국어로 작성하세요:\n"
            "1. 핵심 결론 (1-2문장)\n"
            "2. 주요 발견사항 (에이전트별 핵심 인사이트)\n"
            "3. 실행 권고사항 (구체적 액션 아이템)\n"
            "4. 종합 평가"
        )
        output, usage = await self._call_llm(synthesis_prompt, max_tokens=2000)
        return {"output": output, "usage": usage}


def _log_progress(task_id: str, message: str):
    """Log progress to the global state."""
    entry = {"task_id": task_id, "message": message, "timestamp": time.time()}
    AGENT_TEAM_STATE["progress"].append(entry)
    logger.info("[AgentTeam] %s: %s", task_id, message)


def _store_history(result: Dict[str, Any]):
    """Store a completed task in history."""
    AGENT_TASK_HISTORY.append(result)
    if len(AGENT_TASK_HISTORY) > MAX_HISTORY:
        AGENT_TASK_HISTORY.pop(0)


# Singleton PM instance
_pm_instance: Optional[PMAgent] = None


def get_pm_agent() -> PMAgent:
    """Get or create the PM agent singleton."""
    global _pm_instance
    if _pm_instance is None:
        _pm_instance = PMAgent()
    return _pm_instance
