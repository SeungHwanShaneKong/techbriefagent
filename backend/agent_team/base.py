"""
BaseAgent framework for the MECE Agent Team.
Patch ID: AGENT-TEAM-20260309-074000
"""

from __future__ import annotations

import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from ..llm_service import (
    build_usage_payload,
    estimate_cost_usd,
    extract_usage_from_response,
    get_model_name,
    get_openai_client,
)
from ..logging_config import llm_logger as logger


# ── Data Models ──────────────────────────────────────────────────────

@dataclass
class AgentTask:
    """A task to be executed by an agent."""
    task_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    description: str = ""
    context: Dict[str, Any] = field(default_factory=dict)
    requesting_agent: Optional[str] = None  # agent_id of requester


@dataclass
class AgentContext:
    """Shared context available to all agents during execution."""
    db_stats: Dict[str, Any] = field(default_factory=dict)
    recent_articles: List[Dict[str, Any]] = field(default_factory=list)
    usage_data: Dict[str, Any] = field(default_factory=dict)
    crawl_status: Dict[str, Any] = field(default_factory=dict)
    custom: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentResult:
    """Result returned by an agent after execution."""
    agent_id: str = ""
    agent_name: str = ""
    status: str = "completed"  # "completed" | "error" | "skipped"
    output: str = ""
    data: Dict[str, Any] = field(default_factory=dict)
    usage: Dict[str, Any] = field(default_factory=dict)
    elapsed_ms: float = 0.0
    error: Optional[str] = None


# ── BaseAgent ────────────────────────────────────────────────────────

class BaseAgent:
    """Base class for all agents in the MECE team."""

    agent_id: str = ""
    name_ko: str = ""
    name_en: str = ""
    division: str = ""
    role_description: str = ""
    system_prompt: str = ""
    capabilities: List[str] = []

    def __init__(self):
        if not self.agent_id:
            raise ValueError("agent_id must be set in subclass")

    def info(self) -> Dict[str, Any]:
        """Return agent metadata as a dictionary."""
        return {
            "agent_id": self.agent_id,
            "name_ko": self.name_ko,
            "name_en": self.name_en,
            "division": self.division,
            "role_description": self.role_description,
            "capabilities": list(self.capabilities),
        }

    async def execute(self, task: AgentTask, context: AgentContext) -> AgentResult:
        """Execute a task. Override in subclass for custom logic."""
        start = time.monotonic()
        try:
            output, usage = await self._think(task, context)
            elapsed = (time.monotonic() - start) * 1000
            return AgentResult(
                agent_id=self.agent_id,
                agent_name=self.name_ko,
                status="completed",
                output=output,
                usage=usage,
                elapsed_ms=round(elapsed, 1),
            )
        except Exception as e:
            elapsed = (time.monotonic() - start) * 1000
            logger.error("[%s] execution error: %s", self.agent_id, e, exc_info=True)
            return AgentResult(
                agent_id=self.agent_id,
                agent_name=self.name_ko,
                status="error",
                error=str(e),
                elapsed_ms=round(elapsed, 1),
            )

    async def _think(self, task: AgentTask, context: AgentContext) -> tuple[str, Dict[str, Any]]:
        """
        Core reasoning method. Calls LLM with the agent's system prompt.
        Returns (output_text, usage_dict).
        """
        user_message = self._build_user_message(task, context)
        return await self._call_llm(user_message)

    def _build_user_message(self, task: AgentTask, context: AgentContext) -> str:
        """Build the user message for LLM call. Override for custom formatting."""
        parts = [f"작업 요청: {task.description}"]
        if context.db_stats:
            parts.append(f"시스템 통계: {json.dumps(context.db_stats, ensure_ascii=False, default=str)}")
        if context.usage_data:
            parts.append(f"LLM 사용량: {json.dumps(context.usage_data, ensure_ascii=False, default=str)}")
        if context.crawl_status:
            parts.append(f"크롤링 상태: {json.dumps(context.crawl_status, ensure_ascii=False, default=str)}")
        if context.recent_articles:
            article_summary = []
            for a in context.recent_articles[:20]:
                article_summary.append(
                    f"- [{a.get('category', '')}] {a.get('title', '')[:80]} "
                    f"(감성:{a.get('sentiment_score', 50)}, 키워드:{a.get('keywords', '')})"
                )
            parts.append(f"최근 기사 ({len(context.recent_articles)}건 중 상위 20건):\n" + "\n".join(article_summary))
        if task.context:
            parts.append(f"추가 컨텍스트: {json.dumps(task.context, ensure_ascii=False, default=str)}")
        return "\n\n".join(parts)

    async def _call_llm(self, user_message: str, max_tokens: int = 1500) -> tuple[str, Dict[str, Any]]:
        """Call LLM with the agent's system prompt. Returns (text, usage_dict)."""
        model_name = get_model_name()
        client = get_openai_client()

        if client is None:
            mock_output = f"[{self.agent_id} - {self.name_ko}] API 키 미설정으로 모의 응답을 반환합니다. 작업: {user_message[:200]}"
            return mock_output, build_usage_payload(model_name=model_name, is_mock=True)

        try:
            response = await client.chat.completions.create(
                model=model_name,
                max_tokens=max_tokens,
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": user_message[:8000]},
                ],
            )
            content = response.choices[0].message.content or ""
            usage = extract_usage_from_response(response, model_name)
            return content, usage
        except Exception as e:
            logger.error("[%s] LLM call failed: %s", self.agent_id, e)
            fallback = f"[{self.agent_id}] LLM 호출 실패: {str(e)[:200]}"
            return fallback, build_usage_payload(model_name=model_name, is_mock=True)
