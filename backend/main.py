from collections import Counter
from datetime import date, datetime, timedelta, timezone
import os
from typing import Any, Dict, List, Optional

from pathlib import Path as _Path
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from . import models, schemas
from .logging_config import api_logger as logger, ws_logger
from .llm_service import answer_chatbot_question, summarize_daily_digest
from .database import SessionLocal, engine, get_db
from .startup_check import check_environment
from .crawler import (
    analyze_pending_articles,
    count_degraded_summaries,
    count_pending_analysis_articles,
    count_recent_articles,
    crawl_until_minimum,
    repair_degraded_summaries,
)

import asyncio as _asyncio
import time
import uuid

# ── Patch ID: MECE-FULLSYSTEM-20260308-154500 ──
# Timestamp: 2026-03-08T15:45:00Z
# ── Patch ID: FIX-429-RATE-LIMIT-20260307-153842 ──
# Timestamp: 2026-03-07T15:38:42Z
DAILY_BRIEF_CACHE: Dict[str, Dict[str, Any]] = {}
# B1: asyncio.Lock for async-safe rate limiting (replaces threading.Lock)
_RATE_LIMIT_LOCK = _asyncio.Lock()
_last_crawl_time: float = 0.0
CRAWL_RATE_LIMIT_SECONDS = 30
_last_chatbot_time: float = 0.0
_last_brief_time: float = 0.0
CHATBOT_RATE_LIMIT_SECONDS = 2
BRIEF_RATE_LIMIT_SECONDS = 2


def rate_limit_response(remaining_seconds: float, detail: str) -> JSONResponse:
    """Return a 429 response with Retry-After header for client-side backoff."""
    retry_after = max(int(remaining_seconds) + 1, 1)
    return JSONResponse(
        status_code=429,
        content={"detail": detail},
        headers={"Retry-After": str(retry_after)},
    )
_ws_clients: list = []
_log_queue: _asyncio.Queue = _asyncio.Queue(maxsize=500)

CRAWL_JOB_STATE: Dict[str, Any] = {
    "is_running": False,
    "target_min_articles": 0,
    "current_recent_articles": 0,
    "total_cycles": 0,
    "total_summarized": 0,
    "cycle_target_articles": 0,
    "cycle_processed_articles": 0,
    "current_phase": "idle",
    "collection_progress_pct": 0.0,
    "analysis_progress_pct": 0.0,
    "pending_analysis_count": 0,
    "degraded_summary_count": 0,
    "started_at": None,
    "updated_at": None,
    "message": "대기 중",
}

# Startup checks
check_environment()

# Create DB tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Tech News Intelligence Hub API",
    description="Automated crawling and summarization for global tech trends",
    version="1.0.0"
)

_cors_default = (
    "http://localhost:5173,http://127.0.0.1:5173,"
    "http://localhost:8501,http://127.0.0.1:8501"
)
_cors_origins = os.getenv("CORS_ORIGINS", _cors_default)
_parsed_origins = [o.strip() for o in _cors_origins.split(",") if o.strip()]
# CORS spec: allow_credentials=True is incompatible with wildcard "*" origins.
# When wildcard is configured, disable credentials to avoid browser CORS blocks.
_has_wildcard = "*" in _parsed_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=_parsed_origins,
    allow_credentials=not _has_wildcard,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
)

@app.middleware("http")
async def add_request_id(request, call_next):
    request_id = str(uuid.uuid4())
    logger.debug("→ %s %s [%s]", request.method, request.url.path, request_id)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

def get_crawl_state_snapshot() -> Dict[str, Any]:
    # B5: Lock-free read – dict shallow copy is atomic under CPython GIL
    return dict(CRAWL_JOB_STATE)

def update_crawl_state(**kwargs: Any) -> None:
    # B5: Direct dict update – atomic under CPython GIL, called from serialized crawler callbacks
    CRAWL_JOB_STATE.update(kwargs)
    CRAWL_JOB_STATE["updated_at"] = datetime.now(timezone.utc).isoformat()

# Async helper to trigger crawler until minimum target is met
async def run_crawler_task(min_articles: int):
    db = SessionLocal()
    initial_recent = count_recent_articles(db)
    initial_collection_pct = min((initial_recent / max(min_articles, 1)) * 100.0, 100.0)
    initial_pending = count_pending_analysis_articles(db, hours=48)
    initial_degraded = count_degraded_summaries(db, hours=48)
    update_crawl_state(
        is_running=True,
        target_min_articles=min_articles,
        current_recent_articles=initial_recent,
        total_cycles=0,
        total_summarized=0,
        cycle_target_articles=0,
        cycle_processed_articles=0,
        current_phase="collecting",
        collection_progress_pct=initial_collection_pct,
        analysis_progress_pct=0.0,
        pending_analysis_count=initial_pending,
        degraded_summary_count=initial_degraded,
        started_at=datetime.now(timezone.utc).isoformat(),
        message="최소 기사 수 목표 달성을 위한 반복 수집 시작",
    )
    _asyncio.ensure_future(broadcast_log("크롤링 작업 시작", "info"))
    try:
        def _progress_callback(progress: Dict[str, Any]) -> None:
            update_crawl_state(
                current_recent_articles=int(progress.get("current_recent_articles", 0)),
                total_cycles=int(progress.get("total_rounds", 0)),
                total_summarized=int(progress.get("total_summarized", 0)),
                cycle_target_articles=int(progress.get("cycle_target_articles", 0)),
                cycle_processed_articles=int(progress.get("cycle_processed_articles", 0)),
                current_phase=str(progress.get("current_phase", "collecting")),
                collection_progress_pct=float(progress.get("collection_progress_pct", 0.0)),
                analysis_progress_pct=float(progress.get("analysis_progress_pct", 0.0)),
                pending_analysis_count=int(progress.get("pending_analysis_count", 0)),
                degraded_summary_count=int(progress.get("degraded_summary_count", 0)),
                message=str(progress.get("message", "수집 진행 중")),
            )
            _asyncio.ensure_future(broadcast_log(str(progress.get("message", "수집 진행 중"))))

        result = await crawl_until_minimum(
            db=db,
            min_articles=min_articles,
            progress_callback=_progress_callback,
        )

        def _pending_progress(progress: Dict[str, Any]) -> None:
            pending_total = int(progress.get("pending_total", 0))
            pending_processed = int(progress.get("pending_processed", 0))
            if pending_total <= 0:
                analysis_pct = 100.0
            else:
                analysis_pct = min((pending_processed / pending_total) * 100.0, 100.0)

            update_crawl_state(
                current_phase=str(progress.get("current_phase", "analysis_verify")),
                cycle_target_articles=pending_total,
                cycle_processed_articles=pending_processed,
                analysis_progress_pct=analysis_pct,
                message=str(progress.get("message", "수집 완료 후 분석 검증 중")),
            )
            _asyncio.ensure_future(broadcast_log(str(progress.get("message", "분석 검증 중"))))

        pending_result = await analyze_pending_articles(
            db=db,
            hours=48,
            progress_callback=_pending_progress,
        )

        def _repair_progress(progress: Dict[str, Any]) -> None:
            repair_total = int(progress.get("repair_total", 0))
            repair_processed = int(progress.get("repair_processed", 0))
            analysis_pct = (
                min((repair_processed / max(repair_total, 1)) * 100.0, 100.0)
                if repair_total > 0
                else 100.0
            )
            update_crawl_state(
                current_phase=str(progress.get("current_phase", "analysis_repair")),
                cycle_target_articles=repair_total,
                cycle_processed_articles=repair_processed,
                analysis_progress_pct=analysis_pct,
                message=str(progress.get("message", "모의 요약 재분석 중")),
            )
            _asyncio.ensure_future(broadcast_log(str(progress.get("message", "모의요약 재분석 중"))))

        repair_result = await repair_degraded_summaries(
            db=db,
            hours=48,
            limit=500,
            progress_callback=_repair_progress,
        )

        # Ensure next dashboard request rebuilds daily summary from fresh data.
        DAILY_BRIEF_CACHE.clear()
        final_recent_articles = int(result.get("final_recent_articles", 0))
        final_collection_pct = min((final_recent_articles / max(min_articles, 1)) * 100.0, 100.0)
        final_pending = count_pending_analysis_articles(db, hours=48)
        final_degraded = count_degraded_summaries(db, hours=48)
        update_crawl_state(
            is_running=False,
            current_recent_articles=final_recent_articles,
            total_cycles=int(result.get("total_rounds", 0)),
            total_summarized=int(result.get("total_summarized", 0)) + int(pending_result.get("analyzed_count", 0)),
            cycle_target_articles=0,
            cycle_processed_articles=0,
            current_phase="completed",
            collection_progress_pct=final_collection_pct,
            analysis_progress_pct=100.0,
            pending_analysis_count=final_pending,
            degraded_summary_count=final_degraded,
            message=(
                "목표 기사 수 달성 및 분석 완료 "
                f"(누락 보완 {int(pending_result.get('analyzed_count', 0))}건, "
                f"모의요약 교정 {int(repair_result.get('repaired_count', 0))}건)"
            ),
        )
        _asyncio.ensure_future(broadcast_log("크롤링 및 분석 완료", "info"))
    except _asyncio.CancelledError:
        # B4: Graceful handling of task cancellation
        update_crawl_state(
            is_running=False,
            current_phase="cancelled",
            message="수집 작업이 취소되었습니다.",
        )
        logger.info("Crawler task was cancelled")
        _asyncio.ensure_future(broadcast_log("크롤링 작업 취소됨", "warning"))
    except Exception as e:
        update_crawl_state(
            is_running=False,
            current_phase="error",
            message=f"수집 작업 중 오류: {type(e).__name__}: {e}",
        )
        logger.error("Error in crawler task (%s): %s", type(e).__name__, e, exc_info=True)
        _asyncio.ensure_future(broadcast_log(f"크롤링 오류: {e}", "error"))
    finally:
        db.close()

def get_cutoff_time() -> datetime:
    # Keep dashboard and analytics focused on "last 48h" requirement.
    return datetime.now(timezone.utc) - timedelta(hours=48)

def parse_target_date(target_date: str) -> date:
    try:
        return datetime.strptime(target_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="target_date must be YYYY-MM-DD format")

def _max_allowed_date() -> date:
    """Allow today + 1 day tolerance for timezone differences (e.g. KST vs UTC)."""
    return date.today() + timedelta(days=1)

def get_day_window(target_day: date) -> tuple[datetime, datetime]:
    # Use timezone-naive datetimes to match SQLite storage (pub_date stored as naive UTC).
    # SQLite doesn't support timezone-aware comparisons, so both sides must be naive.
    start = datetime.combine(target_day, datetime.min.time())
    end = start + timedelta(days=1)
    return start, end


_429_RATE_LIMITED_DESC = {"description": "Rate limited – Retry-After header included"}

def get_env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default

@app.post("/api/crawl", response_model=schemas.CrawlerResponse, responses={429: _429_RATE_LIMITED_DESC})
async def trigger_crawling(
    background_tasks: BackgroundTasks,
    min_articles: int = Query(default=30, ge=1, le=5000),
):
    """
    Trigger crawling in the background and keep retrying until minimum article target is met.
    """
    global _last_crawl_time
    current_time = time.time()
    async with _RATE_LIMIT_LOCK:
        if current_time - _last_crawl_time < CRAWL_RATE_LIMIT_SECONDS:
            remaining = CRAWL_RATE_LIMIT_SECONDS - (current_time - _last_crawl_time)
            return rate_limit_response(remaining, f"너무 빠른 요청입니다. {int(remaining)}초 후 다시 시도해 주세요.")
        _last_crawl_time = current_time

    state = get_crawl_state_snapshot()
    if state.get("is_running"):
        return {
            "status": (
                "이미 수집 작업이 실행 중입니다. "
                f"(현재 {state.get('current_recent_articles', 0)}건 / 목표 {state.get('target_min_articles', 0)}건)"
            ),
            "new_articles_count": 0,
            "summarized_count": int(state.get("total_summarized", 0)),
        }

    background_tasks.add_task(run_crawler_task, int(min_articles))
    return {
        "status": f"배경 수집 시작: 최소 {min_articles}건 달성까지 반복 수집",
        "new_articles_count": 0,
        "summarized_count": 0
    }

@app.post("/api/repair-analysis", response_model=schemas.CrawlerResponse)
async def repair_analysis(background_tasks: BackgroundTasks):
    """
    Trigger a background analysis repair run for missing or degraded summaries.
    """
    state = get_crawl_state_snapshot()
    if state.get("is_running"):
        return {
            "status": "다른 수집/분석 작업이 실행 중입니다. 완료 후 다시 시도해 주세요.",
            "new_articles_count": 0,
            "summarized_count": int(state.get("total_summarized", 0)),
        }

    current_recent = int(state.get("current_recent_articles", 0))
    # Reuse crawler task pipeline with current recent target to skip collection phase quickly.
    background_tasks.add_task(run_crawler_task, max(current_recent, 1))
    return {
        "status": "분석 보정 작업 시작: 누락/모의 요약을 자동 재분석합니다.",
        "new_articles_count": 0,
        "summarized_count": 0,
    }

@app.get("/api/crawl-status", response_model=schemas.CrawlStatusResponse)
def get_crawl_status(db: Session = Depends(get_db)):
    """
    Returns current crawling job status and progress.
    """
    state = get_crawl_state_snapshot()
    if not state.get("is_running"):
        current_recent = count_recent_articles(db)
        pending_recent = count_pending_analysis_articles(db)
        degraded_recent = count_degraded_summaries(db)
        analyzed_recent = max(current_recent - pending_recent, 0)
        quality_ready_recent = max(analyzed_recent - degraded_recent, 0)
        state["current_recent_articles"] = current_recent
        target = max(int(state.get("target_min_articles", 0)), 1)
        state["collection_progress_pct"] = min((current_recent / target) * 100.0, 100.0) if target > 0 else 0.0
        state["analysis_progress_pct"] = (
            min((quality_ready_recent / max(current_recent, 1)) * 100.0, 100.0)
            if current_recent > 0
            else 0.0
        )
        state["pending_analysis_count"] = pending_recent
        state["degraded_summary_count"] = degraded_recent
        state["cycle_target_articles"] = 0
        state["cycle_processed_articles"] = 0
        state["current_phase"] = "idle"
        if pending_recent > 0:
            state["message"] = f"미분석 기사 {pending_recent}건이 있어 추가 분석이 필요합니다."
        elif degraded_recent > 0:
            state["message"] = f"모의/저품질 요약 {degraded_recent}건이 있어 재분석이 필요합니다."
        elif int(state.get("target_min_articles", 0)) == 0:
            state["message"] = "대기 중"
    return state

@app.get("/api/news", response_model=schemas.PaginatedNewsResponse)
def get_news(
    skip: int = 0,
    limit: int = 50,
    category: Optional[str] = None,
    keyword: Optional[str] = Query(default=None, max_length=100),
    target_date: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db)
):
    """
    Retrieve summarized news by selected date, or latest 48h when target_date is omitted.
    """
    query = db.query(models.NewsArticle).options(joinedload(models.NewsArticle.summary))
    if target_date:
        target_day = parse_target_date(target_date)
        if target_day > date.today():
            raise HTTPException(status_code=400, detail="미래 날짜는 조회할 수 없습니다.")
        day_start, day_end = get_day_window(target_day)
        query = query.filter(models.NewsArticle.pub_date >= day_start, models.NewsArticle.pub_date < day_end)
    else:
        cutoff = get_cutoff_time()
        query = query.filter(models.NewsArticle.pub_date >= cutoff)

    if category:
        query = query.filter(models.NewsArticle.category == category)

    if keyword:
        # Search in title or summary keywords
        search_filter = f"%{keyword}%"
        query = query.join(models.AISummary).filter(
            (models.NewsArticle.title.ilike(search_filter)) |
            (models.AISummary.keywords.ilike(search_filter))
        )

    total = query.count()
    articles = query.order_by(models.NewsArticle.pub_date.desc()).offset(skip).limit(limit).all()
    return {"items": articles, "total": total, "skip": skip, "limit": limit, "has_more": (skip + limit) < total}

@app.get("/api/news-dates", response_model=List[schemas.NewsDateInfo])
def get_news_dates(
    limit: int = Query(default=90, ge=1, le=365),
    db: Session = Depends(get_db),
):
    """
    Returns available crawl/analyzed dates with article counts.
    """
    rows = (
        db.query(
            func.date(models.NewsArticle.pub_date),
            func.count(models.NewsArticle.id),
        )
        .group_by(func.date(models.NewsArticle.pub_date))
        .order_by(func.date(models.NewsArticle.pub_date).desc())
        .limit(limit)
        .all()
    )
    return [
        {"date": str(row[0]), "article_count": int(row[1])}
        for row in rows
        if row[0] is not None
    ]

@app.get("/api/daily-brief", response_model=schemas.DailyBriefResponse, responses={429: _429_RATE_LIMITED_DESC})
async def get_daily_brief(
    target_date: str = Query(..., description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    """
    Builds a 10-line executive summary and category report for all analyzed articles on a selected day.
    """
    global _last_brief_time
    current_time = time.time()
    async with _RATE_LIMIT_LOCK:
        if current_time - _last_brief_time < BRIEF_RATE_LIMIT_SECONDS:
            remaining = BRIEF_RATE_LIMIT_SECONDS - (current_time - _last_brief_time)
            return rate_limit_response(remaining, f"요청이 너무 빠릅니다. {round(remaining, 1)}초 후 다시 시도해 주세요.")
        _last_brief_time = current_time

    target_day = parse_target_date(target_date)
    if target_day > _max_allowed_date():
        raise HTTPException(status_code=400, detail="미래 날짜는 조회할 수 없습니다.")
    day_start, day_end = get_day_window(target_day)

    rows = (
        db.query(models.NewsArticle, models.AISummary)
        .outerjoin(models.AISummary, models.AISummary.article_id == models.NewsArticle.id)
        .filter(models.NewsArticle.pub_date >= day_start, models.NewsArticle.pub_date < day_end)
        .order_by(models.NewsArticle.pub_date.desc())
        .all()
    )

    if not rows:
        return {
            "target_date": target_date,
            "total_articles": 0,
            "unique_publishers": 0,
            "average_sentiment": 50.0,
            "top_categories": {},
            "top_keywords": [],
            "summary_lines": [
                "해당 날짜에는 분석 가능한 기사 데이터가 없습니다.",
                "좌측에서 다른 날짜를 선택하거나 수동 수집을 실행해 주세요.",
                "수집 완료 후 기사 목록, 키워드, 감성 지표가 자동 갱신됩니다.",
                "원문 파싱이 실패한 소스는 제목 기반 임시 분석으로 보완됩니다.",
                "운영 상태는 대시보드 상단 지표에서 실시간 확인할 수 있습니다.",
                "분석 데이터가 누적되면 카테고리별 요약 리포트가 제공됩니다.",
                "핵심 지표는 기사 수, 감성 평균, 키워드 밀도를 포함합니다.",
                "같은 날짜 재조회 시 비용을 줄이기 위해 캐시를 활용합니다.",
                "모델 응답 실패 시에도 폴백 요약을 제공합니다.",
                "지금은 수집 실행 후 재조회가 필요합니다.",
            ],
            "categorized_summary": [],
            "category_reports": [],
            "generated_with_model": False,
            "strategic_report": None,
        }

    article_payloads: List[Dict[str, Any]] = []
    category_counter: Counter[str] = Counter()
    keyword_counter: Counter[str] = Counter()
    publishers = set()
    sentiments: List[float] = []

    for article, summary in rows:
        publishers.add(str(article.publisher or "Unknown"))
        category = str(article.category or "General Tech")
        category_counter[category] += 1

        summary_text = ""
        keywords = ""
        sentiment_score = 50.0
        if summary is not None:
            summary_text = str(summary.summary_text or "")
            keywords = str(summary.keywords or "")
            if summary.sentiment_score is not None:
                sentiment_score = float(summary.sentiment_score)

        for keyword in keywords.split(","):
            normalized_keyword = keyword.strip()
            if normalized_keyword:
                keyword_counter[normalized_keyword] += 1
        sentiments.append(sentiment_score)

        article_payloads.append(
            {
                "title": article.title,
                "publisher": article.publisher,
                "category": category,
                "summary_text": summary_text,
                "keywords": keywords,
                "sentiment_score": sentiment_score,
            }
        )

    latest_article_id = rows[0][0].id if rows else 0
    summary_ids = [summary.id for _, summary in rows if summary is not None and summary.id is not None]
    summary_count = len(summary_ids)
    max_summary_id = max(summary_ids) if summary_ids else 0
    cache_key = f"{target_date}:{len(rows)}:{latest_article_id}:{summary_count}:{max_summary_id}"
    cached = DAILY_BRIEF_CACHE.get(cache_key)
    if cached:
        return cached

    digest_result = await summarize_daily_digest(target_date, article_payloads)
    usage = digest_result.get("usage", {})
    generated_with_model = not bool(usage.get("is_mock", True))

    if generated_with_model:
        db_usage = models.LLMUsageLog(
            article_id=None,
            model_name=str(usage.get("model_name", os.getenv("OPENAI_MODEL", "gpt-4o-mini"))),
            prompt_tokens=int(usage.get("prompt_tokens", 0) or 0),
            completion_tokens=int(usage.get("completion_tokens", 0) or 0),
            total_tokens=int(usage.get("total_tokens", 0) or 0),
            estimated_cost_usd=float(usage.get("estimated_cost_usd", 0.0) or 0.0),
        )
        db.add(db_usage)
        db.commit()

    avg_sentiment = sum(sentiments) / len(sentiments) if sentiments else 50.0
    result = {
        "target_date": target_date,
        "total_articles": len(rows),
        "unique_publishers": len(publishers),
        "average_sentiment": round(avg_sentiment, 2),
        "top_categories": {name: int(count) for name, count in category_counter.most_common(5)},
        "top_keywords": [name for name, _ in keyword_counter.most_common(10)],
        "summary_lines": digest_result.get("summary_lines", []),
        "categorized_summary": digest_result.get("categorized_summary", []),
        "category_reports": digest_result.get("category_reports", []),
        "generated_with_model": generated_with_model,
        "strategic_report": digest_result.get("strategic_report"),
    }

    # LRU eviction: keep at most 7 entries
    if len(DAILY_BRIEF_CACHE) >= 7:
        oldest_key = next(iter(DAILY_BRIEF_CACHE))
        del DAILY_BRIEF_CACHE[oldest_key]
    DAILY_BRIEF_CACHE[cache_key] = result
    return result

@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    """
    Get statistics for the dashboard heatmap and word cloud.
    """
    cutoff = get_cutoff_time()

    # Basic counts (last 48h)
    total_articles = db.query(models.NewsArticle).filter(models.NewsArticle.pub_date >= cutoff).count()

    # Categories distribution (last 48h)
    categories = (
        db.query(models.NewsArticle.category, func.count(models.NewsArticle.id))
        .filter(models.NewsArticle.pub_date >= cutoff)
        .group_by(models.NewsArticle.category)
        .all()
    )

    # Recent keywords (last 50 articles)
    recent_summaries = (
        db.query(models.AISummary)
        .join(models.NewsArticle, models.AISummary.article_id == models.NewsArticle.id)
        .filter(models.NewsArticle.pub_date >= cutoff)
        .order_by(models.AISummary.id.desc())
        .limit(50)
        .all()
    )
    all_keywords = []
    for s in recent_summaries:
        if s.keywords:
            keys = [k.strip() for k in s.keywords.split(',')]
            all_keywords.extend(keys)

    usage_row = (
        db.query(
            func.coalesce(func.sum(models.LLMUsageLog.estimated_cost_usd), 0.0),
            func.coalesce(func.sum(models.LLMUsageLog.prompt_tokens), 0),
            func.coalesce(func.sum(models.LLMUsageLog.completion_tokens), 0),
            func.coalesce(func.sum(models.LLMUsageLog.total_tokens), 0),
            func.count(models.LLMUsageLog.id),
        )
        .one()
    )

    latest_model_row = (
        db.query(models.LLMUsageLog.model_name)
        .order_by(models.LLMUsageLog.id.desc())
        .first()
    )
    current_model = latest_model_row[0] if latest_model_row else os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    usd_to_krw_rate = get_env_float("USD_TO_KRW_RATE", 1350.0)
    total_cost_usd = float(usage_row[0] or 0.0)
    total_cost_krw = total_cost_usd * usd_to_krw_rate

    daily_cost_rows = (
        db.query(
            func.date(models.LLMUsageLog.created_at),
            func.coalesce(func.sum(models.LLMUsageLog.estimated_cost_usd), 0.0),
        )
        .group_by(func.date(models.LLMUsageLog.created_at))
        .order_by(func.date(models.LLMUsageLog.created_at).asc())
        .limit(14)
        .all()
    )

    return {
        "total_articles": total_articles,
        "categories": {c[0]: c[1] for c in categories},
        "recent_keywords": all_keywords,
        "usage": {
            "current_model": current_model,
            "total_requests": int(usage_row[4] or 0),
            "prompt_tokens": int(usage_row[1] or 0),
            "completion_tokens": int(usage_row[2] or 0),
            "total_tokens": int(usage_row[3] or 0),
            "total_estimated_cost_usd": round(total_cost_usd, 6),
            "total_estimated_cost_krw": int(round(total_cost_krw)),
            "usd_to_krw_rate": usd_to_krw_rate,
            "input_cost_per_1m": get_env_float("OPENAI_INPUT_COST_PER_1M", 0.25),
            "output_cost_per_1m": get_env_float("OPENAI_OUTPUT_COST_PER_1M", 2.0),
        },
        "daily_cost": [
            {"date": str(row[0]), "cost_usd": float(row[1] or 0.0)}
            for row in daily_cost_rows
        ],
    }


@app.post("/api/chatbot", response_model=schemas.ChatbotResponse, responses={429: _429_RATE_LIMITED_DESC})
async def chatbot_query(
    body: schemas.ChatbotRequest,
    db: Session = Depends(get_db),
):
    """
    AI chatbot that answers questions based ONLY on crawled news data.
    Always returns exactly 3 bullet points summarising the core information.
    """
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="질문을 입력해 주세요.")

    global _last_chatbot_time
    current_time = time.time()
    async with _RATE_LIMIT_LOCK:
        if current_time - _last_chatbot_time < CHATBOT_RATE_LIMIT_SECONDS:
            remaining = CHATBOT_RATE_LIMIT_SECONDS - (current_time - _last_chatbot_time)
            return rate_limit_response(remaining, f"요청이 너무 빠릅니다. {round(remaining, 1)}초 후 다시 시도해 주세요.")
        _last_chatbot_time = current_time

    # Retrieve recent articles with summaries (last 7 days for broader context)
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    rows = (
        db.query(models.NewsArticle, models.AISummary)
        .outerjoin(models.AISummary, models.AISummary.article_id == models.NewsArticle.id)
        .filter(models.NewsArticle.pub_date >= cutoff)
        .order_by(models.NewsArticle.pub_date.desc())
        .limit(100)
        .all()
    )

    if not rows:
        return {
            "answer": (
                "• 현재 수집된 뉴스 데이터가 없습니다.\n"
                "• 좌측 패널에서 '수집' 버튼을 눌러 뉴스를 먼저 크롤링해 주세요.\n"
                "• 크롤링 완료 후 다시 질문해 주시면 정확한 답변을 드리겠습니다."
            ),
            "source_count": 0,
            "generated_with_model": False,
        }

    # Build context from crawled articles
    context_parts: List[str] = []
    for article, summary in rows:
        title = article.title or ""
        publisher = article.publisher or ""
        pub_date = str(article.pub_date.strftime("%Y-%m-%d") if article.pub_date else "")
        category = article.category or ""
        summary_text = summary.summary_text if summary else ""
        keywords = summary.keywords if summary else ""
        translated = summary.translated_title if summary else ""

        entry = f"[{pub_date}] [{category}] {title}"
        if translated:
            entry += f" ({translated})"
        entry += f" - {publisher}"
        if summary_text:
            entry += f"\n  요약: {summary_text}"
        if keywords:
            entry += f"\n  키워드: {keywords}"
        context_parts.append(entry)

    context_text = "\n\n".join(context_parts)

    # Build conversation history for multi-turn
    history = body.history or []

    result = await answer_chatbot_question(
        question=question,
        news_context=context_text,
        source_count=len(rows),
        history=[(m.role, m.content) for m in history],
    )

    return result


# ── Agent Team endpoints ──────────────────────────────────────────────
from .agent_team import get_all_agents, get_agents_by_division
from .agent_team.pm_agent import get_pm_agent, AGENT_TEAM_STATE, AGENT_TASK_HISTORY
from .agent_team.base import AgentContext


@app.get("/api/agent/team", response_model=schemas.AgentTeamResponse)
def get_agent_team():
    """Return the full MECE agent team roster (PM + 12 workers)."""
    pm = get_pm_agent()
    all_agents = get_all_agents()
    divisions: Dict[str, list] = {}
    for a in all_agents:
        divisions.setdefault(a.division, []).append(a.info())
    return {
        "pm": pm.info(),
        "divisions": divisions,
        "total_agents": 1 + len(all_agents),  # PM + workers
    }


@app.get("/api/agent/status", response_model=schemas.AgentTeamStatusResponse)
def get_agent_status():
    """Return current agent team execution state."""
    return dict(AGENT_TEAM_STATE)


@app.get("/api/agent/history")
def get_agent_history(limit: int = Query(default=20, ge=1, le=50)):
    """Return recent agent task execution history."""
    return AGENT_TASK_HISTORY[-limit:]


_last_agent_time: float = 0.0
AGENT_RATE_LIMIT_SECONDS = 3


@app.post("/api/agent/execute", response_model=schemas.AgentExecuteResponse, responses={429: _429_RATE_LIMITED_DESC})
async def execute_agent_task(
    body: schemas.AgentExecuteRequest,
    db: Session = Depends(get_db),
):
    """Execute a task through the MECE agent team orchestrated by PM-1."""
    global _last_agent_time
    current_time = time.time()
    async with _RATE_LIMIT_LOCK:
        if current_time - _last_agent_time < AGENT_RATE_LIMIT_SECONDS:
            remaining = AGENT_RATE_LIMIT_SECONDS - (current_time - _last_agent_time)
            return rate_limit_response(remaining, f"요청이 너무 빠릅니다. {int(remaining)}초 후 다시 시도해 주세요.")
        _last_agent_time = current_time

    if AGENT_TEAM_STATE.get("is_running"):
        raise HTTPException(status_code=409, detail="에이전트 팀이 이미 작업 중입니다.")

    task_desc = body.task.strip()
    if not task_desc:
        raise HTTPException(status_code=400, detail="작업 설명을 입력해 주세요.")

    # Build context from current DB state
    cutoff = get_cutoff_time()
    total_articles = db.query(models.NewsArticle).filter(models.NewsArticle.pub_date >= cutoff).count()
    categories = dict(
        db.query(models.NewsArticle.category, func.count(models.NewsArticle.id))
        .filter(models.NewsArticle.pub_date >= cutoff)
        .group_by(models.NewsArticle.category)
        .all()
    )
    usage_row = db.query(
        func.coalesce(func.sum(models.LLMUsageLog.estimated_cost_usd), 0.0),
        func.coalesce(func.sum(models.LLMUsageLog.total_tokens), 0),
        func.count(models.LLMUsageLog.id),
    ).one()

    recent_rows = (
        db.query(models.NewsArticle, models.AISummary)
        .outerjoin(models.AISummary, models.AISummary.article_id == models.NewsArticle.id)
        .filter(models.NewsArticle.pub_date >= cutoff)
        .order_by(models.NewsArticle.pub_date.desc())
        .limit(30)
        .all()
    )
    recent_articles = []
    for article, summary in recent_rows:
        recent_articles.append({
            "title": article.title,
            "category": article.category,
            "publisher": article.publisher,
            "sentiment_score": summary.sentiment_score if summary else 50.0,
            "keywords": summary.keywords if summary else "",
        })

    context = AgentContext(
        db_stats={"total_articles_48h": total_articles, "categories": categories},
        recent_articles=recent_articles,
        usage_data={"total_cost_usd": float(usage_row[0]), "total_tokens": int(usage_row[1]), "total_requests": int(usage_row[2])},
        crawl_status=get_crawl_state_snapshot(),
    )

    pm = get_pm_agent()
    result = await pm.orchestrate(task_desc, context, target_agents=body.target_agents)
    return result


async def broadcast_log(message: str, level: str = "info"):
    """Broadcast a log message to all connected WebSocket clients."""
    if not _ws_clients:
        return
    payload = {"type": "log", "level": level, "message": message, "timestamp": datetime.now(timezone.utc).isoformat()}
    disconnected = []
    for ws in _ws_clients:
        try:
            await ws.send_json(payload)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        _ws_clients.remove(ws)


_MAX_WS_CLIENTS = 20  # B2: Limit concurrent WebSocket connections

@app.websocket("/ws/logs")
async def websocket_logs(websocket: WebSocket):
    """WebSocket endpoint for real-time log streaming."""
    # B2: Reject if too many concurrent connections
    if len(_ws_clients) >= _MAX_WS_CLIENTS:
        await websocket.close(code=1013, reason="Too many connections")
        ws_logger.warning("WebSocket rejected: max clients (%d) reached", _MAX_WS_CLIENTS)
        return
    await websocket.accept()
    _ws_clients.append(websocket)
    ws_logger.info("WebSocket client connected (total: %d)", len(_ws_clients))
    try:
        while True:
            try:
                data = await _asyncio.wait_for(websocket.receive_text(), timeout=60.0)
                ws_logger.debug("Received from WS client: %s", data[:100])
            except _asyncio.TimeoutError:
                # Send ping to keep alive
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    break
    except WebSocketDisconnect:
        ws_logger.info("WebSocket client disconnected")
    except (ConnectionResetError, RuntimeError) as e:
        # B4: Specific exception types for connection-level errors
        ws_logger.info("WebSocket connection reset: %s", e)
    except Exception as e:
        ws_logger.warning("WebSocket unexpected error (%s): %s", type(e).__name__, e)
    finally:
        if websocket in _ws_clients:
            _ws_clients.remove(websocket)


# ── Static file serving (SPA) ──────────────────────────────────────
# Serve the built React frontend when frontend/dist exists.
_FRONTEND_DIR = _Path(__file__).resolve().parent.parent / "frontend" / "dist"
# Also check /app/static for Docker deployments
_STATIC_DIR = _Path("/app/static")

def _get_spa_dir() -> _Path | None:
    if _STATIC_DIR.is_dir() and (_STATIC_DIR / "index.html").exists():
        return _STATIC_DIR
    if _FRONTEND_DIR.is_dir() and (_FRONTEND_DIR / "index.html").exists():
        return _FRONTEND_DIR
    return None

_spa_dir = _get_spa_dir()
if _spa_dir is not None:
    # Mount /assets as static files for JS/CSS bundles
    _assets_dir = _spa_dir / "assets"
    if _assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="static-assets")

    @app.get("/favicon.ico")
    async def favicon():
        fav = _spa_dir / "favicon.ico"
        if fav.exists():
            return FileResponse(str(fav))
        return FileResponse(str(_spa_dir / "index.html"))

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        """Catch-all: serve static file if exists, otherwise index.html (SPA fallback)."""
        # Don't intercept /api or /ws or /docs or /openapi.json
        if full_path.startswith(("api/", "ws/", "docs", "redoc", "openapi.json")):
            raise HTTPException(status_code=404)
        # Try to serve the exact file
        file_path = _spa_dir / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        # SPA fallback
        return FileResponse(str(_spa_dir / "index.html"))

    logger.info("SPA static serving enabled from: %s", _spa_dir)
else:
    logger.info("No frontend dist found – API-only mode")
