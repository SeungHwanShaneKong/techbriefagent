"""
Agent Registry – central catalog of all 13 MECE agents.
Patch ID: AGENT-TEAM-20260309-074000
"""

from __future__ import annotations

from typing import Dict, List

from .base import BaseAgent

# ── Planning Division ────────────────────────────────────────────────
from .planning.strategic_planner import StrategicPlannerAgent
from .planning.content_strategist import ContentStrategistAgent
from .planning.resource_planner import ResourcePlannerAgent

# ── AI Engineering Division ──────────────────────────────────────────
from .ai_engineering.prompt_engineer import PromptEngineerAgent
from .ai_engineering.model_analyst import ModelAnalystAgent
from .ai_engineering.pipeline_engineer import PipelineEngineerAgent

# ── Development Division ─────────────────────────────────────────────
from .development.backend_architect import BackendArchitectAgent
from .development.frontend_architect import FrontendArchitectAgent
from .development.infra_engineer import InfraEngineerAgent

# ── Marketing Division ───────────────────────────────────────────────
from .marketing.content_marketer import ContentMarketerAgent
from .marketing.engagement_analyst import EngagementAnalystAgent
from .marketing.brand_communicator import BrandCommunicatorAgent


def _build_registry() -> Dict[str, BaseAgent]:
    """Instantiate all agents and index by agent_id."""
    agents: List[BaseAgent] = [
        # Planning
        StrategicPlannerAgent(),
        ContentStrategistAgent(),
        ResourcePlannerAgent(),
        # AI Engineering
        PromptEngineerAgent(),
        ModelAnalystAgent(),
        PipelineEngineerAgent(),
        # Development
        BackendArchitectAgent(),
        FrontendArchitectAgent(),
        InfraEngineerAgent(),
        # Marketing
        ContentMarketerAgent(),
        EngagementAnalystAgent(),
        BrandCommunicatorAgent(),
    ]
    return {a.agent_id: a for a in agents}


# Singleton registry (does NOT include PM-1 – PM orchestrates, not registered as a worker)
AGENT_REGISTRY: Dict[str, BaseAgent] = _build_registry()


def get_agent(agent_id: str) -> BaseAgent | None:
    """Look up an agent by its ID."""
    return AGENT_REGISTRY.get(agent_id)


def get_all_agents() -> List[BaseAgent]:
    """Return all registered worker agents (excluding PM)."""
    return list(AGENT_REGISTRY.values())


def get_agents_by_division(division: str) -> List[BaseAgent]:
    """Return all agents belonging to a specific division."""
    return [a for a in AGENT_REGISTRY.values() if a.division == division]


# Division lookup constants
DIVISIONS = {
    "Planning": ["PL-1", "PL-2", "PL-3"],
    "AI Engineering": ["AE-1", "AE-2", "AE-3"],
    "Development": ["DV-1", "DV-2", "DV-3"],
    "Marketing": ["MK-1", "MK-2", "MK-3"],
}
