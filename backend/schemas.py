from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Dict, List, Literal, Optional

class AISummaryBase(BaseModel):
    summary_text: str
    keywords: str
    sentiment_score: float
    translated_title: Optional[str] = None

class AISummaryCreate(AISummaryBase):
    article_id: int

class AISummary(AISummaryBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    article_id: int

class NewsArticleBase(BaseModel):
    title: str
    original_url: str
    publisher: str
    pub_date: datetime
    category: str
    raw_content: str

class NewsArticleCreate(NewsArticleBase):
    pass

class NewsArticle(NewsArticleBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    summary: Optional[AISummary] = None

class PaginatedNewsResponse(BaseModel):
    items: List[NewsArticle]
    total: int
    skip: int
    limit: int
    has_more: bool

class CrawlerResponse(BaseModel):
    status: str
    new_articles_count: int
    summarized_count: int

class CrawlStatusResponse(BaseModel):
    is_running: bool
    target_min_articles: int
    current_recent_articles: int
    total_cycles: int
    total_summarized: int
    cycle_target_articles: int = 0
    cycle_processed_articles: int = 0
    current_phase: str = "idle"
    collection_progress_pct: float = 0.0
    analysis_progress_pct: float = 0.0
    pending_analysis_count: int = 0
    degraded_summary_count: int = 0
    started_at: Optional[str] = None
    updated_at: Optional[str] = None
    message: str

class CategoryReport(BaseModel):
    category: str
    article_count: int
    average_sentiment: float
    key_topics: List[str]
    executive_summary: str


# ── Strategic Intelligence Report structures ──────────────────────────
class StrategicPillar(BaseModel):
    """A thematic deep-dive section (e.g. 'AI Governance', 'Semiconductor Supply Chain')."""
    theme: str
    situation: str
    implication: str


class HighValueSignal(BaseModel):
    """A risk or opportunity signal with recommended strategic response."""
    signal_type: str          # "Critical Risk" | "Opportunity" | "Watch"
    description: str
    strategic_response: str


class ConsultantBriefing(BaseModel):
    """Final strategic wrap-up from the consultant persona."""
    insight: str
    watch_list: List[str]


class ExecutiveSummaryBlock(BaseModel):
    """Section 1 of the report – core pulse."""
    core_message: str
    keywords: List[str]
    sentiment_label: str      # e.g. "긍정 62.3/100"
    market_narrative: str     # 1-paragraph market flow description


class StrategicReport(BaseModel):
    """Complete strategic intelligence report matching the HTML template."""
    executive_summary: ExecutiveSummaryBlock
    strategic_pillars: List[StrategicPillar]
    high_value_signals: List[HighValueSignal]
    consultant_briefing: ConsultantBriefing


class NewsDateInfo(BaseModel):
    date: str
    article_count: int


class CategorizedSummaryItem(BaseModel):
    """One of 5 summary categories, each with exactly 2 bullet points."""
    category: str
    bullets: List[str]


class DailyBriefResponse(BaseModel):
    target_date: str
    total_articles: int
    unique_publishers: int
    average_sentiment: float
    top_categories: Dict[str, int]
    top_keywords: List[str]
    summary_lines: List[str]
    categorized_summary: Optional[List[CategorizedSummaryItem]] = None
    category_reports: List[CategoryReport]
    generated_with_model: bool
    # New: structured strategic intelligence report
    strategic_report: Optional[StrategicReport] = None


# ── Chatbot schemas ──────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ChatbotRequest(BaseModel):
    question: str
    history: Optional[List[ChatMessage]] = None

class ChatbotResponse(BaseModel):
    answer: str                # 3 bullet points
    source_count: int          # number of articles referenced
    generated_with_model: bool


# ── Agent Team schemas ───────────────────────────────────────────────
class AgentInfo(BaseModel):
    agent_id: str
    name_ko: str
    name_en: str
    division: str
    role_description: str
    capabilities: List[str]


class AgentExecuteRequest(BaseModel):
    task: str
    target_agents: Optional[List[str]] = None


class AgentResultItem(BaseModel):
    output: str
    status: str
    elapsed_ms: float = 0.0


class AgentExecuteResponse(BaseModel):
    task_id: str
    status: str
    task_description: str
    agents_involved: List[str]
    selection_reason: str
    agent_results: Dict[str, AgentResultItem]
    synthesis: str
    total_cost_usd: float
    elapsed_ms: float


class AgentTeamStatusResponse(BaseModel):
    is_running: bool
    current_task_id: Optional[str] = None
    agents_involved: List[str]
    progress: List[Dict]
    last_result: Optional[Dict] = None


class AgentTeamResponse(BaseModel):
    pm: AgentInfo
    divisions: Dict[str, List[AgentInfo]]
    total_agents: int


# ── Admin schemas ────────────────────────────────────────────────────
class FeedInfo(BaseModel):
    name: str
    url: str

class FeedCreateRequest(BaseModel):
    name: str
    url: str

class AdminConfig(BaseModel):
    min_articles: int = 30
    crawl_rate_limit_seconds: int = 30
    chatbot_rate_limit_seconds: int = 2
    brief_rate_limit_seconds: int = 2
    current_model: str = "gpt-4o-mini"
    feeds: List[FeedInfo] = []

class AdminConfigUpdate(BaseModel):
    min_articles: Optional[int] = None
    crawl_rate_limit_seconds: Optional[int] = None
    chatbot_rate_limit_seconds: Optional[int] = None
    brief_rate_limit_seconds: Optional[int] = None

class AdminLogEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    model_name: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    estimated_cost_usd: float
    created_at: datetime


# ── Search schemas ───────────────────────────────────────────────────
class SearchResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    original_url: str
    publisher: str
    pub_date: datetime
    category: str
    summary_text: Optional[str] = None
    keywords: Optional[str] = None
    sentiment_score: Optional[float] = None
    translated_title: Optional[str] = None

class SearchResponse(BaseModel):
    results: List[SearchResult]
    total: int
    query: str


# ── Bookmark schemas ─────────────────────────────────────────────────
class BookmarkCreate(BaseModel):
    article_id: int
    note: Optional[str] = None

class BookmarkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    article_id: int
    note: Optional[str] = None
    created_at: datetime
    article: Optional[NewsArticle] = None


# ── Analytics schemas ────────────────────────────────────────────────
class SentimentTrendPoint(BaseModel):
    date: str
    avg_sentiment: float
    article_count: int

class SentimentTrendResponse(BaseModel):
    days: int
    trend: List[SentimentTrendPoint]
    by_category: Dict[str, List[SentimentTrendPoint]]

class CategoryComparisonItem(BaseModel):
    category: str
    article_count: int
    avg_sentiment: float
    top_keywords: List[str]

class CategoryComparisonResponse(BaseModel):
    categories: List[CategoryComparisonItem]


# ── Chatbot enhanced schemas ────────────────────────────────────────
class ChatSourceArticle(BaseModel):
    id: int
    title: str
    original_url: str
