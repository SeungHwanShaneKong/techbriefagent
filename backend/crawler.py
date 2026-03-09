import asyncio
import hashlib
import os
import random
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import feedparser
import requests
from bs4 import BeautifulSoup
from playwright.async_api import Browser, async_playwright
from requests.adapters import HTTPAdapter
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from urllib3 import disable_warnings
from urllib3.exceptions import InsecureRequestWarning
from urllib3.util.retry import Retry

from . import models
from .llm_service import summarize_and_analyze, get_model_name
from .logging_config import crawler_logger as logger

_DEFAULT_RSS_FEEDS = {
    # ── Tier 1: Major Global Tech Media ──────────────────────────────
    "TechCrunch": "https://techcrunch.com/feed/",
    "Wired": "https://www.wired.com/feed/rss",
    "The Verge": "https://www.theverge.com/rss/index.xml",
    "VentureBeat": "https://venturebeat.com/feed/",
    "Ars Technica": "https://feeds.arstechnica.com/arstechnica/index/",
    "MIT Technology Review": "https://www.technologyreview.com/feed/",
    "ZDNet": "https://www.zdnet.com/news/rss.xml",
    "Engadget": "https://www.engadget.com/rss.xml",
    "IEEE Spectrum": "https://spectrum.ieee.org/rss/fulltext",
    "InfoQ": "https://www.infoq.com/feed/",
    "Android Authority": "https://www.androidauthority.com/feed/",
    # ── Tier 2: Hardware / Mobile / Consumer Tech ────────────────────
    "Tom's Hardware": "https://www.tomshardware.com/feeds/all",
    "9to5Google": "https://9to5google.com/feed/",
    "9to5Mac": "https://9to5mac.com/feed/",
    "MacRumors": "https://feeds.macrumors.com/MacRumors-All",
    "The Next Web": "https://thenextweb.com/feed/",
    "SlashGear": "https://www.slashgear.com/feed/",
    # ── Tier 3: AI / Enterprise / Dev ────────────────────────────────
    "TechRadar": "https://www.techradar.com/rss",
    "CNET": "https://www.cnet.com/rss/news/",
    "Gizmodo": "https://gizmodo.com/rss",
    "Mashable": "https://mashable.com/feeds/rss/all",
    "The Register": "https://www.theregister.com/headlines.atom",
    # ── Tier 4: Science / Deep-Tech / Niche ──────────────────────────
    "Hacker News (Best)": "https://hnrss.org/best",
    "Digital Trends": "https://www.digitaltrends.com/feed/",
    "ScienceDaily Tech": "https://www.sciencedaily.com/rss/computers_math.xml",
}

# Runtime-mutable feed registry (initialized from defaults)
RSS_FEEDS: Dict[str, str] = dict(_DEFAULT_RSS_FEEDS)


def get_feeds() -> Dict[str, str]:
    """Return current RSS feeds (runtime mutable)."""
    return dict(RSS_FEEDS)


def add_feed(name: str, url: str) -> bool:
    """Add or update an RSS feed. Returns True if new, False if updated."""
    is_new = name not in RSS_FEEDS
    RSS_FEEDS[name] = url
    return is_new


def remove_feed(name: str) -> bool:
    """Remove an RSS feed by name. Returns True if removed."""
    if name in RSS_FEEDS:
        del RSS_FEEDS[name]
        return True
    return False

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:128.0) Gecko/20100101 Firefox/128.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
]

REQUEST_HEADERS_BASE = {
    "Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
}

MIN_REQUEST_DELAY_SECONDS = 0.4
MAX_REQUEST_DELAY_SECONDS = 1.4
NO_PROGRESS_WAIT_SECONDS = 60
SUMMARY_RETRY_ATTEMPTS = 3

CRAWL_MAX_DURATION_MINUTES = int(os.getenv("CRAWL_MAX_DURATION_MINUTES", "30"))

disable_warnings(InsecureRequestWarning)

def get_utc_now():
    return datetime.now(timezone.utc)

def build_requests_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=2,
        connect=2,
        read=2,
        backoff_factor=0.8,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=frozenset(["GET"]),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=30, pool_maxsize=30)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session

def _to_pub_datetime(entry) -> Optional[datetime]:
    pub_tuple = entry.get("published_parsed") or entry.get("updated_parsed")
    if not pub_tuple:
        return None
    return datetime(
        pub_tuple.tm_year,
        pub_tuple.tm_mon,
        pub_tuple.tm_mday,
        pub_tuple.tm_hour,
        pub_tuple.tm_min,
        pub_tuple.tm_sec,
        tzinfo=timezone.utc,
    )

def _extract_article_text_via_http(url: str, session: requests.Session) -> str:
    headers = {
        **REQUEST_HEADERS_BASE,
        "User-Agent": random.choice(USER_AGENTS),
    }
    try:
        response = session.get(url, headers=headers, timeout=20)
        response.raise_for_status()
    except requests.exceptions.SSLError:
        # Corporate/local SSL interception can break cert trust in some environments.
        try:
            response = session.get(url, headers=headers, timeout=20, verify=False)
            response.raise_for_status()
        except Exception as ssl_error:
            logger.warning("HTTP fallback error on %s: %s", url, ssl_error)
            return ""
    except Exception as e:
        logger.warning("HTTP extraction error on %s: %s", url, e)
        return ""

    soup = BeautifulSoup(response.text, "html.parser")
    paragraphs = [p.get_text(" ", strip=True) for p in soup.find_all("p")]
    text_content = "\n".join([p for p in paragraphs if len(p) > 40])
    return text_content[:5000]

async def extract_article_text(url: str, browser: Optional[Browser]) -> str:
    if browser is None:
        return ""
    page = await browser.new_page()
    try:
        try:
            await page.route("**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2,ttf,eot}", lambda route: route.abort())
        except Exception:
            pass
        await page.set_extra_http_headers(
            {
                **REQUEST_HEADERS_BASE,
                "User-Agent": random.choice(USER_AGENTS),
            }
        )
        await page.goto(url, wait_until="domcontentloaded", timeout=12000)
        paragraphs = await page.eval_on_selector_all("p", "elements => elements.map(e => e.innerText)")
        text_content = "\n".join([p for p in paragraphs if len(p.strip()) > 20])
        return text_content[:5000]
    except Exception as e:
        logger.warning("Playwright error on %s: %s", url, e)
        return ""
    finally:
        await page.close()

async def extract_article_text_with_fallback(url: str, browser: Optional[Browser], session: requests.Session) -> str:
    text_content = await extract_article_text(url, browser)
    if text_content:
        return text_content
    return await asyncio.to_thread(_extract_article_text_via_http, url, session)

def count_recent_articles(db: Session, hours: int = 48) -> int:
    cutoff_time = get_utc_now() - timedelta(hours=hours)
    return (
        db.query(models.NewsArticle)
        .filter(models.NewsArticle.pub_date >= cutoff_time)
        .count()
    )

def count_pending_analysis_articles(db: Session, hours: int = 48) -> int:
    cutoff_time = get_utc_now() - timedelta(hours=hours)
    return (
        db.query(models.NewsArticle)
        .outerjoin(models.AISummary, models.AISummary.article_id == models.NewsArticle.id)
        .filter(models.NewsArticle.pub_date >= cutoff_time, models.AISummary.id.is_(None))
        .count()
    )

def _degraded_summary_filter():
    lower_keywords = func.lower(func.coalesce(models.AISummary.keywords, ""))
    lower_summary = func.lower(func.coalesce(models.AISummary.summary_text, ""))
    return or_(
        lower_keywords.like("%mock%"),
        lower_keywords.like("%demo%"),
        lower_keywords.like("%setup%"),
        lower_summary.like("%api 키 미설정%"),
        lower_summary.like("%모의 요약%"),
        lower_summary.like("%openai_api_key%"),
        lower_summary.like("%mock%"),
    )

def count_degraded_summaries(db: Session, hours: int = 48) -> int:
    cutoff_time = get_utc_now() - timedelta(hours=hours)
    return (
        db.query(models.AISummary)
        .join(models.NewsArticle, models.AISummary.article_id == models.NewsArticle.id)
        .filter(models.NewsArticle.pub_date >= cutoff_time, _degraded_summary_filter())
        .count()
    )

def _has_real_api_key() -> bool:
    api_key = os.getenv("OPENAI_API_KEY", "")
    return bool(api_key and api_key != "your_openai_api_key_here")

def _is_mock_summary_result(summary_result: Dict[str, Any]) -> bool:
    usage = summary_result.get("usage", {})
    if bool(usage.get("is_mock", False)):
        return True
    analysis = summary_result.get("analysis", {})
    keywords = str(analysis.get("keywords", "")).lower()
    summary_text = str(analysis.get("summary_text", "")).lower()
    return (
        ("mock" in keywords)
        or ("api 키 미설정" in summary_text)
        or ("모의 요약" in summary_text)
        or ("openai_api_key" in summary_text)
    )

async def summarize_with_retry(raw_text: str, title: str) -> Dict[str, Any]:
    result = await summarize_and_analyze(raw_text, title)
    if not _is_mock_summary_result(result):
        return result
    if not _has_real_api_key():
        return result

    last_result = result
    for attempt in range(2, SUMMARY_RETRY_ATTEMPTS + 1):
        await asyncio.sleep(min(2 * attempt, 8))
        retried = await summarize_and_analyze(raw_text, title)
        last_result = retried
        if not _is_mock_summary_result(retried):
            return retried
    return last_result

def _fetch_single_feed(publisher: str, url: str, session: requests.Session) -> tuple:
    """Fetch a single RSS feed. Returns (publisher, entries) or (publisher, [])."""
    try:
        feed_response = session.get(
            url,
            headers={**REQUEST_HEADERS_BASE, "User-Agent": random.choice(USER_AGENTS)},
            timeout=15,
            verify=False,
        )
        feed_response.raise_for_status()
        feed = feedparser.parse(feed_response.content)
        return (publisher, feed.entries if feed.entries else [])
    except Exception as feed_error:
        logger.warning("RSS load error (%s): %s", publisher, feed_error)
        return (publisher, [])

async def crawl_feeds(
    db: Session,
    per_run_limit: Optional[int] = None,
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> Tuple[int, int]:
    now = get_utc_now()
    cutoff_time = now - timedelta(hours=48)

    existing_urls = set(
        hashlib.md5(row[0].encode()).hexdigest() for row in db.query(models.NewsArticle.original_url).all()
    )

    new_articles: List[Dict[str, object]] = []
    session = build_requests_session()

    # 1. Parse RSS Feeds in parallel and filter
    feed_results = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {
            executor.submit(_fetch_single_feed, pub, url, session): pub
            for pub, url in RSS_FEEDS.items()
        }
        for future in as_completed(futures):
            feed_results.append(future.result())

    for publisher, entries in feed_results:
        if not entries:
            continue

        for entry in entries:
            pub_dt = _to_pub_datetime(entry)
            if pub_dt is None or pub_dt < cutoff_time:
                continue

            link = entry.get("link")
            title = entry.get("title")
            if not link or not title:
                continue

            fallback_content = ""
            if entry.get("summary"):
                fallback_content = BeautifulSoup(str(entry.get("summary")), "html.parser").get_text(" ", strip=True)
            elif entry.get("description"):
                fallback_content = BeautifulSoup(str(entry.get("description")), "html.parser").get_text(" ", strip=True)

            # Check if already known (pre-loaded set instead of per-article DB query)
            if hashlib.md5(link.encode()).hexdigest() not in existing_urls:
                new_articles.append({
                    "title": title,
                    "url": link,
                    "publisher": publisher,
                    "pub_date": pub_dt,
                    "fallback_content": fallback_content[:2000],
                })
                existing_urls.add(hashlib.md5(link.encode()).hexdigest())  # prevent duplicates within the same batch

    logger.info("Found %d new articles across feeds", len(new_articles))

    if per_run_limit is not None and per_run_limit > 0:
        articles_to_process = new_articles[:per_run_limit]
    else:
        articles_to_process = new_articles

    summarized_count = 0
    if progress_callback:
        progress_callback(
            {
                "stage": "analysis_prepare",
                "cycle_discovered_articles": len(new_articles),
                "cycle_target_articles": len(articles_to_process),
                "cycle_processed_articles": 0,
                "cycle_summarized_articles": 0,
            }
        )

    if not articles_to_process:
        session.close()
        return 0, 0

    playwright = None
    browser: Optional[Browser] = None
    try:
        try:
            playwright = await async_playwright().start()
            browser = await playwright.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                ],
            )
        except Exception as browser_error:
            logger.warning("Playwright launch failed, using HTTP fallback only: %s", browser_error)
            browser = None

        for idx, item in enumerate(articles_to_process, start=1):
            logger.info("Processing: %s", item['title'])
            await asyncio.sleep(random.uniform(MIN_REQUEST_DELAY_SECONDS, MAX_REQUEST_DELAY_SECONDS))
            raw_text = await extract_article_text_with_fallback(str(item["url"]), browser, session)
            if not raw_text:
                raw_text = str(item.get("fallback_content", "")) or str(item["title"]) # fallback

            # 2. LLM Summarization
            summary_result = await summarize_with_retry(raw_text, str(item["title"]))
            analysis = summary_result.get("analysis", {})
            usage = summary_result.get("usage", {})

            # 3. Save to DB
            db_article = models.NewsArticle(
                title=str(item["title"]),
                original_url=str(item["url"]),
                publisher=str(item["publisher"]),
                pub_date=item["pub_date"],
                category=analysis.get("category", "General Tech"),
                raw_content=raw_text
            )
            try:
                db.add(db_article)
                db.flush()  # get the ID without committing
            except IntegrityError:
                db.rollback()
                logger.info("Skipping duplicate article: %s", item['url'])
                continue

            db_summary = models.AISummary(
                article_id=db_article.id,
                summary_text=analysis.get("summary_text", "Summary unavailable"),
                keywords=analysis.get("keywords", "General Tech"),
                sentiment_score=float(analysis.get("sentiment_score", 50.0)),
                translated_title=analysis.get("translated_title") or None,
            )
            db.add(db_summary)
            db_usage = models.LLMUsageLog(
                article_id=db_article.id,
                model_name=str(usage.get("model_name", get_model_name())),
                prompt_tokens=int(usage.get("prompt_tokens", 0) or 0),
                completion_tokens=int(usage.get("completion_tokens", 0) or 0),
                total_tokens=int(usage.get("total_tokens", 0) or 0),
                estimated_cost_usd=float(usage.get("estimated_cost_usd", 0.0) or 0.0),
            )
            db.add(db_usage)
            summarized_count += 1

            # Batch commit every 10 articles
            if summarized_count % 10 == 0:
                try:
                    db.commit()
                except Exception as commit_err:
                    logger.error("Batch commit failed: %s", commit_err)
                    db.rollback()
            if progress_callback:
                progress_callback(
                    {
                        "stage": "analysis_progress",
                        "cycle_discovered_articles": len(new_articles),
                        "cycle_target_articles": len(articles_to_process),
                        "cycle_processed_articles": idx,
                        "cycle_summarized_articles": summarized_count,
                    }
                )

        # Commit any remaining articles not yet committed by the batch logic
        try:
            db.commit()
        except Exception as final_err:
            logger.error("Final commit failed: %s", final_err)
            db.rollback()
    finally:
        session.close()
        if browser is not None:
            await browser.close()
        if playwright is not None:
            await playwright.stop()

    if progress_callback:
        progress_callback(
            {
                "stage": "analysis_complete",
                "cycle_discovered_articles": len(new_articles),
                "cycle_target_articles": len(articles_to_process),
                "cycle_processed_articles": len(articles_to_process),
                "cycle_summarized_articles": summarized_count,
            }
        )

    return len(articles_to_process), summarized_count

async def crawl_until_minimum(
    db: Session,
    min_articles: int,
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> Dict[str, int]:
    total_discovered = 0
    total_summarized = 0
    total_rounds = 0
    no_progress_rounds = 0
    _start = time.time()

    while True:
        elapsed_min = (time.time() - _start) / 60
        if elapsed_min >= CRAWL_MAX_DURATION_MINUTES:
            logger.warning(f"⏱ 크롤링 최대 시간 초과 ({CRAWL_MAX_DURATION_MINUTES}분). 자동 중단.")
            break

        current_total = count_recent_articles(db)
        collection_progress_pct = min((current_total / max(min_articles, 1)) * 100.0, 100.0)
        if progress_callback:
            progress_callback(
                {
                    "current_phase": "collecting",
                    "current_recent_articles": current_total,
                    "total_rounds": total_rounds,
                    "total_summarized": total_summarized,
                    "cycle_target_articles": 0,
                    "cycle_processed_articles": 0,
                    "analysis_progress_pct": 0.0,
                    "collection_progress_pct": collection_progress_pct,
                    "message": "목표 달성을 위해 수집 반복 중",
                }
            )

        if current_total >= min_articles:
            break

        remaining = max(min_articles - current_total, 1)
        per_run_limit = min(max(remaining * 3, 20), 400)

        def _cycle_progress(event: Dict[str, Any]) -> None:
            stage = str(event.get("stage", "analysis_progress"))
            cycle_target = int(event.get("cycle_target_articles", 0))
            cycle_processed = int(event.get("cycle_processed_articles", 0))
            cycle_summarized = int(event.get("cycle_summarized_articles", 0))
            latest_total = count_recent_articles(db)
            latest_collection_pct = min((latest_total / max(min_articles, 1)) * 100.0, 100.0)
            analysis_pct = (
                min((cycle_processed / max(cycle_target, 1)) * 100.0, 100.0)
                if cycle_target > 0
                else 100.0
            )
            phase = "analyzing" if stage != "analysis_complete" else "analysis_complete"

            if progress_callback:
                progress_callback(
                    {
                        "current_phase": phase,
                        "current_recent_articles": latest_total,
                        "total_rounds": total_rounds + 1,
                        "total_summarized": total_summarized + cycle_summarized,
                        "cycle_target_articles": cycle_target,
                        "cycle_processed_articles": cycle_processed,
                        "analysis_progress_pct": analysis_pct,
                        "collection_progress_pct": latest_collection_pct,
                        "message": "기사 분석 진행 중",
                    }
                )

        discovered, summarized = await crawl_feeds(
            db,
            per_run_limit=per_run_limit,
            progress_callback=_cycle_progress,
        )
        total_rounds += 1
        total_discovered += discovered
        total_summarized += summarized

        latest_total = count_recent_articles(db)
        latest_collection_pct = min((latest_total / max(min_articles, 1)) * 100.0, 100.0)
        if progress_callback:
            progress_callback(
                {
                    "current_phase": "collecting",
                    "current_recent_articles": latest_total,
                    "total_rounds": total_rounds,
                    "total_summarized": total_summarized,
                    "cycle_target_articles": discovered,
                    "cycle_processed_articles": summarized,
                    "analysis_progress_pct": 100.0 if discovered > 0 else 0.0,
                    "collection_progress_pct": latest_collection_pct,
                    "message": "수집 라운드 완료, 목표 달성 여부 재확인 중",
                }
            )

        if latest_total >= min_articles:
            break

        # No new article discovered in this round -> wait and retry.
        if discovered == 0 and summarized == 0:
            no_progress_rounds += 1
            wait_seconds = min(NO_PROGRESS_WAIT_SECONDS * no_progress_rounds, 300)
        else:
            no_progress_rounds = 0
            wait_seconds = random.randint(15, 45)

        if progress_callback:
            progress_callback(
                {
                    "current_phase": "waiting_retry",
                    "current_recent_articles": latest_total,
                    "total_rounds": total_rounds,
                    "total_summarized": total_summarized,
                    "cycle_target_articles": 0,
                    "cycle_processed_articles": 0,
                    "analysis_progress_pct": 0.0,
                    "collection_progress_pct": latest_collection_pct,
                    "message": f"목표 미달성. {wait_seconds}초 후 재시도",
                }
            )

        await asyncio.sleep(wait_seconds)

    return {
        "final_recent_articles": count_recent_articles(db),
        "total_discovered": total_discovered,
        "total_summarized": total_summarized,
        "total_rounds": total_rounds,
    }

async def analyze_pending_articles(
    db: Session,
    hours: int = 48,
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> Dict[str, int]:
    cutoff_time = get_utc_now() - timedelta(hours=hours)
    pending_articles = (
        db.query(models.NewsArticle)
        .outerjoin(models.AISummary, models.AISummary.article_id == models.NewsArticle.id)
        .filter(models.NewsArticle.pub_date >= cutoff_time, models.AISummary.id.is_(None))
        .order_by(models.NewsArticle.pub_date.desc())
        .all()
    )

    total_pending = len(pending_articles)
    analyzed_count = 0
    if progress_callback:
        progress_callback(
            {
                "current_phase": "analysis_verify",
                "pending_total": total_pending,
                "pending_processed": 0,
                "message": "미분석 기사 검증을 시작합니다.",
            }
        )

    for idx, article in enumerate(pending_articles, start=1):
        raw_text = str(article.raw_content or article.title or "")
        summary_result = await summarize_with_retry(raw_text, str(article.title or ""))
        analysis = summary_result.get("analysis", {})
        usage = summary_result.get("usage", {})

        db_summary = models.AISummary(
            article_id=article.id,
            summary_text=analysis.get("summary_text", "Summary unavailable"),
            keywords=analysis.get("keywords", "General Tech"),
            sentiment_score=float(analysis.get("sentiment_score", 50.0)),
            translated_title=analysis.get("translated_title") or None,
        )
        db.add(db_summary)

        db_usage = models.LLMUsageLog(
            article_id=article.id,
            model_name=str(usage.get("model_name", get_model_name())),
            prompt_tokens=int(usage.get("prompt_tokens", 0) or 0),
            completion_tokens=int(usage.get("completion_tokens", 0) or 0),
            total_tokens=int(usage.get("total_tokens", 0) or 0),
            estimated_cost_usd=float(usage.get("estimated_cost_usd", 0.0) or 0.0),
        )
        db.add(db_usage)
        db.commit()
        analyzed_count += 1

        if progress_callback:
            progress_callback(
                {
                    "current_phase": "analysis_verify",
                    "pending_total": total_pending,
                    "pending_processed": idx,
                    "message": "미분석 기사 분석 진행 중",
                }
            )

    if progress_callback:
        progress_callback(
            {
                "current_phase": "analysis_verify_complete",
                "pending_total": total_pending,
                "pending_processed": total_pending,
                "message": "미분석 기사 검증/분석 완료",
            }
        )

    return {
        "pending_total": total_pending,
        "analyzed_count": analyzed_count,
        "remaining_pending": count_pending_analysis_articles(db, hours=hours),
    }

async def repair_degraded_summaries(
    db: Session,
    hours: int = 48,
    limit: int = 500,
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> Dict[str, int]:
    cutoff_time = get_utc_now() - timedelta(hours=hours)
    rows = (
        db.query(models.NewsArticle, models.AISummary)
        .join(models.AISummary, models.AISummary.article_id == models.NewsArticle.id)
        .filter(models.NewsArticle.pub_date >= cutoff_time, _degraded_summary_filter())
        .order_by(models.NewsArticle.pub_date.desc())
        .limit(limit)
        .all()
    )

    total_target = len(rows)
    repaired_count = 0
    if progress_callback:
        progress_callback(
            {
                "current_phase": "analysis_repair",
                "repair_total": total_target,
                "repair_processed": 0,
                "message": "모의/저품질 요약 재분석을 시작합니다.",
            }
        )

    for idx, (article, summary) in enumerate(rows, start=1):
        raw_text = str(article.raw_content or article.title or "")
        summary_result = await summarize_with_retry(raw_text, str(article.title or ""))
        if not _is_mock_summary_result(summary_result):
            analysis = summary_result.get("analysis", {})
            usage = summary_result.get("usage", {})

            summary.summary_text = analysis.get("summary_text", summary.summary_text)
            summary.keywords = analysis.get("keywords", summary.keywords)
            summary.sentiment_score = float(analysis.get("sentiment_score", summary.sentiment_score or 50.0))
            summary.translated_title = analysis.get("translated_title") or summary.translated_title
            db.add(summary)

            db_usage = models.LLMUsageLog(
                article_id=article.id,
                model_name=str(usage.get("model_name", get_model_name())),
                prompt_tokens=int(usage.get("prompt_tokens", 0) or 0),
                completion_tokens=int(usage.get("completion_tokens", 0) or 0),
                total_tokens=int(usage.get("total_tokens", 0) or 0),
                estimated_cost_usd=float(usage.get("estimated_cost_usd", 0.0) or 0.0),
            )
            db.add(db_usage)
            db.commit()
            repaired_count += 1

        if progress_callback:
            progress_callback(
                {
                    "current_phase": "analysis_repair",
                    "repair_total": total_target,
                    "repair_processed": idx,
                    "message": "모의/저품질 요약 재분석 진행 중",
                }
            )

    if progress_callback:
        progress_callback(
            {
                "current_phase": "analysis_repair_complete",
                "repair_total": total_target,
                "repair_processed": total_target,
                "message": "모의/저품질 요약 재분석 완료",
            }
        )

    return {
        "target_total": total_target,
        "repaired_count": repaired_count,
        "remaining_degraded": count_degraded_summaries(db, hours=hours),
    }
