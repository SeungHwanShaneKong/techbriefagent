import json
import os
from collections import Counter
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv
from openai import AsyncOpenAI

from .logging_config import llm_logger as logger

load_dotenv()

DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_INPUT_COST_PER_1M = 0.25
DEFAULT_OUTPUT_COST_PER_1M = 2.00
DEFAULT_SSL_VERIFY = False

MAX_TOKENS_ARTICLE = int(os.getenv("OPENAI_MAX_TOKENS_ARTICLE", "1000"))
MAX_TOKENS_DIGEST = int(os.getenv("OPENAI_MAX_TOKENS_DIGEST", "4000"))

ALLOWED_CATEGORIES = {"AI", "Robotics", "Bio-tech", "Semiconductor", "Blockchain", "General Tech"}

MODEL_PRICING: Dict[str, Dict[str, float]] = {
    "gpt-4o-mini": {"input_per_1m": 0.15, "output_per_1m": 0.60},
    "gpt-4o": {"input_per_1m": 2.50, "output_per_1m": 10.00},
    "gpt-4-turbo": {"input_per_1m": 10.00, "output_per_1m": 30.00},
    "gpt-3.5-turbo": {"input_per_1m": 0.50, "output_per_1m": 1.50},
}

_openai_client: Optional[AsyncOpenAI] = None
_openai_client_api_key: Optional[str] = None

def get_env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default

def get_model_name() -> str:
    return os.getenv("OPENAI_MODEL", DEFAULT_MODEL)

def get_ssl_verify() -> bool:
    value = os.getenv("OPENAI_SSL_VERIFY")
    if value is None:
        return DEFAULT_SSL_VERIFY
    return value.strip().lower() not in {"0", "false", "no", "off"}

def get_pricing() -> Dict[str, float]:
    model = get_model_name()
    if model in MODEL_PRICING:
        return MODEL_PRICING[model]
    # Fall back to env vars or defaults
    return {
        "input_per_1m": get_env_float("OPENAI_INPUT_COST_PER_1M", DEFAULT_INPUT_COST_PER_1M),
        "output_per_1m": get_env_float("OPENAI_OUTPUT_COST_PER_1M", DEFAULT_OUTPUT_COST_PER_1M),
    }

def get_openai_client() -> Optional[AsyncOpenAI]:
    global _openai_client, _openai_client_api_key
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "your_openai_api_key_here":
        return None
    # Re-create client if API key changed
    if _openai_client is None or _openai_client_api_key != api_key:
        http_client = httpx.AsyncClient(verify=get_ssl_verify(), timeout=httpx.Timeout(connect=10.0, read=45.0, write=10.0, pool=10.0))
        _openai_client = AsyncOpenAI(api_key=api_key, http_client=http_client)
        _openai_client_api_key = api_key
    return _openai_client

def estimate_cost_usd(prompt_tokens: int, completion_tokens: int) -> float:
    pricing = get_pricing()
    input_cost = (prompt_tokens / 1_000_000) * pricing["input_per_1m"]
    output_cost = (completion_tokens / 1_000_000) * pricing["output_per_1m"]
    return round(input_cost + output_cost, 8)

def build_usage_payload(
    model_name: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    total_tokens: Optional[int] = None,
    estimated_cost_usd: float = 0.0,
    is_mock: bool = False,
) -> Dict[str, Any]:
    pricing = get_pricing()
    if total_tokens is None:
        total_tokens = prompt_tokens + completion_tokens
    return {
        "model_name": model_name,
        "prompt_tokens": int(prompt_tokens),
        "completion_tokens": int(completion_tokens),
        "total_tokens": int(total_tokens),
        "estimated_cost_usd": float(estimated_cost_usd),
        "input_cost_per_1m": pricing["input_per_1m"],
        "output_cost_per_1m": pricing["output_per_1m"],
        "is_mock": bool(is_mock),
    }

def extract_usage_from_response(response: Any, model_name: str) -> Dict[str, Any]:
    usage = getattr(response, "usage", None)
    prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
    completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
    total_tokens = int(getattr(usage, "total_tokens", prompt_tokens + completion_tokens) or (prompt_tokens + completion_tokens))
    estimated_cost = estimate_cost_usd(prompt_tokens, completion_tokens)
    return build_usage_payload(
        model_name=model_name,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        estimated_cost_usd=estimated_cost,
        is_mock=False,
    )

def build_mock_response(title: str = "") -> Dict[str, Any]:
    # Keep the service available even when no API key is configured.
    return {
        "summary_text": "1. API 연결 상태를 점검했습니다.\n2. 현재 기사에서 핵심 내용을 임시 요약으로 표시합니다.\n3. 모델 응답 실패 시에도 파이프라인은 계속 동작합니다.",
        "keywords": "Mock, Demo, Setup",
        "sentiment_score": 50.0,
        "category": "General Tech",
        "translated_title": title if title else None,
    }

SUMMARY_CATEGORIES = ["AI/인공지능", "반도체/하드웨어", "소프트웨어/클라우드", "비즈니스/산업", "보안/규제"]


def normalize_summary_lines(lines: List[str], desired_lines: int = 10) -> List[str]:
    normalized: List[str] = []
    for line in lines:
        cleaned = str(line).strip()
        if not cleaned:
            continue
        if cleaned.startswith(("1.", "2.", "3.", "4.", "5.", "6.", "7.", "8.", "9.", "10.", "-", "•", "*")):
            cleaned = cleaned.lstrip("0123456789.-•* ").strip()
        if cleaned:
            normalized.append(cleaned)

    while len(normalized) < desired_lines:
        normalized.append("데이터를 기반으로 후속 분석 포인트를 지속 업데이트합니다.")

    return normalized[:desired_lines]


def normalize_categorized_summary(raw: Any) -> List[Dict[str, Any]]:
    """
    Normalize LLM output for categorized_summary into a list of
    {"category": str, "bullets": [str, str]}.
    Ensures exactly 5 categories with 2 bullets each.
    """
    result: List[Dict[str, Any]] = []
    if isinstance(raw, list):
        for item in raw[:5]:
            if isinstance(item, dict):
                cat = str(item.get("category", "")).strip()
                bullets_raw = item.get("bullets", [])
                # B3: Guard against None or unexpected types from LLM response
                if bullets_raw is None:
                    bullets_raw = []
                if isinstance(bullets_raw, str):
                    bullets_raw = [b.strip() for b in bullets_raw.split("\n") if b.strip()]
                if not isinstance(bullets_raw, list):
                    bullets_raw = []
                bullets = [str(b).strip() for b in bullets_raw if str(b).strip()][:2]
                while len(bullets) < 2:
                    bullets.append("추가 분석 데이터를 수집 중입니다.")
                if cat:
                    result.append({"category": cat, "bullets": bullets})

    # Pad to 5 categories if needed
    used_cats = {item["category"] for item in result}
    for default_cat in SUMMARY_CATEGORIES:
        if len(result) >= 5:
            break
        if default_cat not in used_cats:
            result.append({
                "category": default_cat,
                "bullets": [
                    "해당 카테고리의 주요 동향을 지속 모니터링합니다.",
                    "추가 데이터 수집 후 상세 분석이 업데이트됩니다.",
                ],
            })
    return result[:5]

def build_category_reports_fallback(article_payloads: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    category_groups: Dict[str, Dict[str, Any]] = {}
    for item in article_payloads:
        category = str(item.get("category", "General Tech"))
        group = category_groups.setdefault(
            category,
            {
                "article_count": 0,
                "sentiments": [],
                "keywords": Counter(),
                "titles": [],
            },
        )
        group["article_count"] += 1
        group["titles"].append(str(item.get("title", "")))
        try:
            group["sentiments"].append(float(item.get("sentiment_score", 50.0)))
        except (TypeError, ValueError):
            group["sentiments"].append(50.0)
        for keyword in str(item.get("keywords", "")).split(","):
            normalized_keyword = keyword.strip()
            if normalized_keyword:
                group["keywords"][normalized_keyword] += 1

    reports: List[Dict[str, Any]] = []
    for category, payload in sorted(category_groups.items(), key=lambda x: x[1]["article_count"], reverse=True):
        sentiments = payload["sentiments"]
        avg_sentiment = (sum(sentiments) / len(sentiments)) if sentiments else 50.0
        top_topics = [name for name, _ in payload["keywords"].most_common(5)]
        representative_title = payload["titles"][0] if payload["titles"] else "핵심 이슈 집계 중"
        reports.append(
            {
                "category": category,
                "article_count": int(payload["article_count"]),
                "average_sentiment": round(avg_sentiment, 2),
                "key_topics": top_topics,
                "executive_summary": (
                    f"{category} 카테고리는 총 {payload['article_count']}건으로 집계되었고, "
                    f"대표 이슈는 '{representative_title[:80]}'입니다."
                ),
            }
        )
    return reports

def _build_categorized_summary_fallback(article_payloads: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Build a deterministic 5-category x 2-bullet summary from article data."""
    # Map article categories to the 5 summary categories
    CATEGORY_MAP: Dict[str, str] = {
        "AI": "AI/인공지능",
        "Robotics": "반도체/하드웨어",
        "Semiconductor": "반도체/하드웨어",
        "Bio-tech": "비즈니스/산업",
        "Blockchain": "소프트웨어/클라우드",
        "General Tech": "소프트웨어/클라우드",
    }
    groups: Dict[str, List[Dict[str, Any]]] = {cat: [] for cat in SUMMARY_CATEGORIES}
    for item in article_payloads:
        raw_cat = str(item.get("category", "General Tech"))
        mapped = CATEGORY_MAP.get(raw_cat, "비즈니스/산업")
        groups[mapped].append(item)

    result: List[Dict[str, Any]] = []
    for cat in SUMMARY_CATEGORIES:
        items = groups.get(cat, [])
        if items:
            titles = [str(a.get("title", "")) for a in items[:3]]
            kws = []
            for a in items[:5]:
                for kw in str(a.get("keywords", "")).split(","):
                    k = kw.strip()
                    if k and k not in kws:
                        kws.append(k)
            bullet1 = f"{cat} 분야에서 '{titles[0][:60]}' 등 {len(items)}건의 기사가 보도되었으며, {', '.join(kws[:3])} 키워드가 주목받고 있습니다."
            bullet2 = (
                f"{'및 '.join(titles[1:3][:2])[:80]}에서 드러나듯, 해당 영역의 기술 변화가 가속화되고 있어 전략적 모니터링이 필요합니다."
                if len(titles) > 1
                else f"{cat} 영역의 후속 동향을 지속 추적하여 의사결정 포인트를 도출할 필요가 있습니다."
            )
        else:
            bullet1 = f"{cat} 분야에서는 금일 주요 보도가 제한적이나, 글로벌 동향 모니터링을 지속합니다."
            bullet2 = f"향후 {cat} 관련 이슈 발생 시 즉각적인 분석 업데이트가 이루어집니다."
        result.append({"category": cat, "bullets": [bullet1, bullet2]})
    return result


def build_daily_digest_fallback(target_date: str, article_payloads: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not article_payloads:
        empty_categorized = [
            {"category": cat, "bullets": [
                f"{cat} 분야의 데이터가 아직 수집되지 않았습니다.",
                "크롤링 작업 실행 후 자동으로 분석이 업데이트됩니다.",
            ]}
            for cat in SUMMARY_CATEGORIES
        ]
        return {
            "summary_lines": [
                f"{target_date}에는 수집된 기사가 없어 분석 결과를 생성하지 못했습니다.",
                "크롤링 작업을 실행한 뒤 동일 날짜를 다시 선택해 주세요.",
                "수집 완료 후 카테고리, 감성, 키워드 분석이 자동으로 반영됩니다.",
                "요약 정확도를 위해 발행사별 최신 RSS 소스 연결 상태를 점검합니다.",
                "운영 지표는 데이터 유입 즉시 대시보드에 업데이트됩니다.",
                "데이터가 확보되면 카테고리별 리포트와 10줄 요약이 생성됩니다.",
                "핵심 신호는 빈도, 감성, 발행사 신뢰도 기준으로 정렬됩니다.",
                "일자 단위 비교를 통해 트렌드 가속 구간을 파악할 수 있습니다.",
                "비용 지표를 통해 분석 효율과 운영 예산을 함께 관리할 수 있습니다.",
                "현 시점에서는 후속 수집 작업이 우선 과제입니다.",
            ],
            "category_reports": [],
            "categorized_summary": empty_categorized,
        }

    category_reports = build_category_reports_fallback(article_payloads)
    categorized_summary = _build_categorized_summary_fallback(article_payloads)

    # Keep legacy summary_lines for backward compat (flattened from categorized)
    summary_lines: List[str] = []
    for cs in categorized_summary:
        for b in cs["bullets"]:
            summary_lines.append(b)
    summary_lines = summary_lines[:10]

    return {
        "summary_lines": summary_lines,
        "category_reports": category_reports,
        "categorized_summary": categorized_summary,
    }

async def summarize_and_analyze(raw_content: str, title: str):
    """
    Uses OpenAI (configurable model) to generate summary + usage metadata.
    Returns a dict: {"analysis": {...}, "usage": {...}}
    """
    model_name = get_model_name()
    client: Optional[AsyncOpenAI] = get_openai_client()
    if client is None:
        return {
            "analysis": build_mock_response(title),
            "usage": build_usage_payload(model_name=model_name, is_mock=True),
        }

    try:
        system_prompt = """
        You are an expert Tech News Analyst. Read the following tech news article and provide:
        1. A 3-bullet point summary in Korean (핵심 요약 3줄).
        2. 3-5 keywords in Korean, comma separated.
        3. Sentiment score from 0 to 100 (0 = highly negative, 50 = neutral, 100 = highly positive).
        4. Category (choose ONE: AI, Robotics, Bio-tech, Semiconductor, Blockchain, General Tech).
        5. A natural, fluent Korean translation of the article title (translated_title). Translate the meaning, not word-by-word. Keep proper nouns (company names, product names) in their original form.

        Respond ONLY in the following JSON format:
        {
            "summary_text": "1. ...\\n2. ...\\n3. ...",
            "keywords": "keyword1, keyword2, keyword3",
            "sentiment_score": 80.5,
            "category": "AI",
            "translated_title": "기사 제목의 한국어 번역"
        }
        """

        response = await client.chat.completions.create(
            model=model_name,
            response_format={"type": "json_object"},
            max_tokens=MAX_TOKENS_ARTICLE,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Title: {title}\n\nContent:\n{raw_content[:4000]}"},
            ],
        )

        content = response.choices[0].message.content or "{}"
        result = json.loads(content)

        # ── Validate and sanitize LLM outputs ──
        summary_text = result.get("summary_text") or None
        if not summary_text or not str(summary_text).strip():
            summary_text = "요약을 생성할 수 없습니다."
        else:
            summary_text = str(summary_text)

        keywords = result.get("keywords", "일반 기술")

        try:
            sentiment_score = float(result.get("sentiment_score", 50.0))
        except (TypeError, ValueError):
            sentiment_score = 50.0
        sentiment_score = max(0.0, min(100.0, sentiment_score))

        category = result.get("category", "General Tech")
        if category not in ALLOWED_CATEGORIES:
            category = "General Tech"

        translated_title = result.get("translated_title") or None
        if translated_title and len(translated_title) > 500:
            translated_title = translated_title[:500]

        return {
            "analysis": {
                "summary_text": summary_text,
                "keywords": keywords,
                "sentiment_score": sentiment_score,
                "category": category,
                "translated_title": translated_title,
            },
            "usage": extract_usage_from_response(response, model_name),
        }
    except Exception as e:
        logger.error("Error in summarize_and_analyze: %s", e, exc_info=True)
        return {
            "analysis": build_mock_response(title),
            "usage": build_usage_payload(model_name=model_name, is_mock=True),
        }

def _build_digest_source_rows(article_payloads: List[Dict[str, Any]], limit: int = 120) -> str:
    """Build a compact text block from article payloads for LLM context."""
    rows: List[str] = []
    for idx, item in enumerate(article_payloads[:limit], start=1):
        rows.append(
            f"{idx}. [{item.get('category', 'General Tech')}] {item.get('title', '')} | "
            f"매체:{item.get('publisher', '')} | 키워드:{item.get('keywords', '')} | "
            f"감성:{item.get('sentiment_score', 50.0)} | 요약:{str(item.get('summary_text', ''))[:180]}"
        )
    return "\n".join(rows)


def _normalize_category_reports(
    parsed_reports: Any, fallback_reports: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Safely normalize LLM-returned category_reports list."""
    normalized: List[Dict[str, Any]] = []
    if not isinstance(parsed_reports, list):
        return fallback_reports

    for item in parsed_reports[:10]:
        if not isinstance(item, dict):
            continue
        category = str(item.get("category", "")).strip()
        if not category:
            continue
        key_topics_raw = item.get("key_topics", [])
        if isinstance(key_topics_raw, str):
            key_topics = [t.strip() for t in key_topics_raw.split(",") if t.strip()]
        elif isinstance(key_topics_raw, list):
            key_topics = [str(t).strip() for t in key_topics_raw if str(t).strip()]
        else:
            key_topics = []
        try:
            average_sentiment = float(item.get("average_sentiment", 50.0))
        except (TypeError, ValueError):
            average_sentiment = 50.0
        try:
            article_count = int(item.get("article_count", 0))
        except (TypeError, ValueError):
            article_count = 0
        normalized.append({
            "category": category,
            "article_count": max(article_count, 0),
            "average_sentiment": round(average_sentiment, 2),
            "key_topics": key_topics[:8],
            "executive_summary": str(item.get("executive_summary", "")).strip()
            or f"{category} 카테고리의 핵심 이슈를 모니터링해야 합니다.",
        })
    return normalized if normalized else fallback_reports


def build_strategic_report_fallback(
    target_date: str,
    article_payloads: List[Dict[str, Any]],
    avg_sentiment: float,
) -> Dict[str, Any]:
    """Build a deterministic strategic report when LLM is unavailable."""
    total = len(article_payloads)
    cat_counter: Counter = Counter(str(a.get("category", "General Tech")) for a in article_payloads)
    kw_counter: Counter = Counter()
    for a in article_payloads:
        for kw in str(a.get("keywords", "")).split(","):
            k = kw.strip()
            if k:
                kw_counter[k] += 1
    top_cats = [name for name, _ in cat_counter.most_common(3)]
    top_kws = [name for name, _ in kw_counter.most_common(5)]

    sentiment_label = "긍정" if avg_sentiment > 60 else ("부정" if avg_sentiment < 40 else "중립")

    return {
        "executive_summary": {
            "core_message": f"{target_date} 기준 {total}건의 글로벌 테크 기사에서 {', '.join(top_cats[:2])} 중심의 기술 변화가 감지되었습니다.",
            "keywords": top_kws[:5],
            "sentiment_label": f"{sentiment_label} {avg_sentiment:.1f}/100",
            "market_narrative": (
                f"금일 수집된 {total}건의 기사를 종합하면, {', '.join(top_cats)} 영역에서 "
                f"유의미한 움직임이 관측됩니다. 전체 감성 지수는 {avg_sentiment:.1f}/100으로 "
                f"{'시장 참여자들의 낙관적 전망이 우세합니다.' if avg_sentiment > 55 else '시장의 불확실성이 반영되고 있습니다.'}"
            ),
        },
        "strategic_pillars": [
            {
                "theme": f"{top_cats[0] if top_cats else 'General Tech'} 기술 동향",
                "situation": f"{top_cats[0] if top_cats else 'General Tech'} 카테고리에서 {cat_counter.most_common(1)[0][1] if cat_counter else 0}건의 기사가 집중 보도되었습니다.",
                "implication": "해당 영역의 기술 성숙도와 시장 수용성을 면밀히 모니터링할 필요가 있습니다.",
            },
            {
                "theme": f"{top_cats[1] if len(top_cats) > 1 else '산업 생태계'} 생태계 변화",
                "situation": f"{'및 '.join(top_cats[1:3]) if len(top_cats) > 1 else '산업 전반'}에서 구조적 변화 신호가 포착되었습니다.",
                "implication": "공급망 재편과 기술 표준 변화에 대한 선제적 대응 전략이 필요합니다.",
            },
        ],
        "high_value_signals": [
            {
                "signal_type": "Critical Risk",
                "description": "기술 패권 경쟁 심화에 따른 공급망 불확실성이 증가하고 있습니다.",
                "strategic_response": "핵심 기술 의존도를 점검하고 대안 소싱 전략을 수립해야 합니다.",
            },
            {
                "signal_type": "Opportunity",
                "description": f"{''.join(top_kws[:2]) + ' ' if top_kws else ''}관련 신규 시장 기회가 포착되었습니다.",
                "strategic_response": "파일럿 프로젝트를 통한 조기 시장 진입을 검토할 것을 권고합니다.",
            },
        ],
        "consultant_briefing": {
            "insight": (
                f"금일 글로벌 테크 시장은 {', '.join(top_cats[:2]) if top_cats else '기술 전반'}을 중심으로 "
                f"{'활발한 혁신 활동' if avg_sentiment > 55 else '구조적 전환기'}에 진입하고 있습니다. "
                "의사결정자는 단기 변동성보다 중장기 기술 트렌드에 초점을 맞출 것을 권고합니다."
            ),
            "watch_list": [
                f"{top_kws[0]} 관련 규제 동향" if top_kws else "글로벌 기술 규제 동향",
                f"{top_cats[0] if top_cats else 'AI'} 분야 주요 기업 실적 발표",
                "거시경제 지표와 기술 투자 상관관계 변화",
            ],
        },
    }


async def summarize_daily_digest(target_date: str, article_payloads: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Generates 10-line Korean executive summary + category grouped report + strategic intelligence report.
    Returns {"summary_lines": [...10], "category_reports": [...], "strategic_report": {...}, "usage": {...}, "is_fallback": bool}
    """
    fallback_payload = build_daily_digest_fallback(target_date, article_payloads)
    fallback_lines = fallback_payload.get("summary_lines", [])
    fallback_category_reports = fallback_payload.get("category_reports", [])

    # Compute avg sentiment for fallback
    sentiments = []
    for a in article_payloads:
        try:
            sentiments.append(float(a.get("sentiment_score", 50.0)))
        except (TypeError, ValueError):
            sentiments.append(50.0)
    avg_sentiment = sum(sentiments) / len(sentiments) if sentiments else 50.0

    fallback_strategic = build_strategic_report_fallback(target_date, article_payloads, avg_sentiment)

    model_name = get_model_name()
    client: Optional[AsyncOpenAI] = get_openai_client()
    if client is None:
        return {
            "summary_lines": fallback_lines,
            "categorized_summary": fallback_payload.get("categorized_summary", _build_categorized_summary_fallback(article_payloads)),
            "category_reports": fallback_category_reports,
            "strategic_report": fallback_strategic,
            "usage": build_usage_payload(model_name=model_name, is_mock=True),
            "is_fallback": True,
        }

    digest_source = _build_digest_source_rows(article_payloads)

    system_prompt = """You are a friendly, knowledgeable tech industry analyst writing a daily intelligence brief in Korean.
Your audience is a GENERAL reader — NOT a domain expert. Explain things clearly, avoid unnecessary jargon, and always clarify WHY something matters in practical, everyday terms.
Based on the provided article analysis records, produce a comprehensive yet accessible intelligence report.

Return ONLY JSON in this EXACT structure:
{
  "categorized_summary": [
    {
      "category": "AI/인공지능",
      "bullets": [
        "해당 카테고리의 첫 번째 핵심 인사이트 — 무슨 일이 있었고, 왜 중요한지 쉽게 설명 (2-3문장)",
        "해당 카테고리의 두 번째 핵심 인사이트 — 우리 생활이나 산업에 어떤 영향을 주는지 (2-3문장)"
      ]
    },
    {
      "category": "반도체/하드웨어",
      "bullets": ["...", "..."]
    },
    {
      "category": "소프트웨어/클라우드",
      "bullets": ["...", "..."]
    },
    {
      "category": "비즈니스/산업",
      "bullets": ["...", "..."]
    },
    {
      "category": "보안/규제",
      "bullets": ["...", "..."]
    }
  ],
  "category_reports": [
    {
      "category": "AI",
      "article_count": 10,
      "average_sentiment": 64.5,
      "key_topics": ["키워드1", "키워드2", "키워드3"],
      "executive_summary": "이 분야에서 오늘 가장 중요한 변화를 한 문장으로 요약"
    }
  ],
  "strategic_report": {
    "executive_summary": {
      "core_message": "오늘의 기술 뉴스를 한 문장으로 요약 — 비전문가도 바로 이해할 수 있게 (한국어)",
      "keywords": ["#키워드1", "#키워드2", "#키워드3", "#키워드4", "#키워드5"],
      "sentiment_label": "긍정/부정/중립 수치 (예: 긍정 62.3/100)",
      "market_narrative": "오늘 기술 업계에서 무슨 일이 있었는지, 왜 주목해야 하는지를 일반인 눈높이에서 2-3문장으로 설명"
    },
    "strategic_pillars": [
      {
        "theme": "테마명 (예: AI가 일상에 미치는 변화)",
        "situation": "무슨 일이 일어나고 있는지 쉽게 설명 (2-3문장, 전문 용어 사용 시 괄호 안에 뜻 병기)",
        "implication": "이것이 우리 생활·비즈니스에 어떤 의미인지 (1-2문장)"
      }
    ],
    "high_value_signals": [
      {
        "signal_type": "주의 필요",
        "description": "어떤 위험이 있는지 쉽게 설명",
        "strategic_response": "어떻게 대비하면 좋을지 실용적 조언"
      },
      {
        "signal_type": "새로운 기회",
        "description": "어떤 기회가 열리고 있는지 설명",
        "strategic_response": "이 기회를 어떻게 활용할 수 있는지 조언"
      }
    ],
    "consultant_briefing": {
      "insight": "오늘의 핵심 메시지 총정리 (2-3문장, 누구나 이해할 수 있는 쉬운 말로)",
      "watch_list": ["앞으로 주목할 이슈1", "앞으로 주목할 이슈2", "앞으로 주목할 이슈3"]
    }
  }
}

CRITICAL RULES:
- categorized_summary MUST have EXACTLY 5 categories: "AI/인공지능", "반도체/하드웨어", "소프트웨어/클라우드", "비즈니스/산업", "보안/규제"
- Each category MUST have EXACTLY 2 bullet points
- Each bullet point must be a DETAILED, SPECIFIC insight based on ACTUAL article content (not generic filler)
- Focus on the NEWS CONTENT itself — what happened, why it matters, what the practical impact is
- Do NOT mention article counts or meta-information in the bullets — focus purely on substance
- strategic_pillars should have 2-4 items, each representing a major thematic cluster from today's news
- high_value_signals should have 2-4 items; use signal_type values: "주의 필요" (risk), "새로운 기회" (opportunity), or "관찰 중" (watch)
- All text MUST be in Korean
- Be specific and data-driven, referencing actual article themes
- WRITE IN PLAIN, ACCESSIBLE KOREAN — avoid consultant jargon, acronyms without explanation, or overly formal expressions
- When using technical terms, briefly explain them in parentheses (e.g., "LLM(대규모 언어 모델)")
- Prioritize clarity and practical relevance over impressive-sounding language"""

    try:
        response = await client.chat.completions.create(
            model=model_name,
            response_format={"type": "json_object"},
            max_tokens=MAX_TOKENS_DIGEST,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": (
                        f"대상 날짜: {target_date}\n"
                        f"기사 수: {len(article_payloads)}\n"
                        f"평균 감성: {avg_sentiment:.1f}/100\n"
                        "분석 데이터:\n"
                        f"{digest_source}"
                    ),
                },
            ],
        )

        content = response.choices[0].message.content or "{}"
        parsed = json.loads(content)

        # ── categorized_summary (new: 5 categories x 2 bullets) ──
        raw_cs = parsed.get("categorized_summary")
        categorized_summary = normalize_categorized_summary(raw_cs)
        if not categorized_summary or len(categorized_summary) < 5:
            categorized_summary = fallback_payload.get("categorized_summary", _build_categorized_summary_fallback(article_payloads))

        # ── summary_lines (flatten from categorized for backward compat) ──
        summary_lines: List[str] = []
        for cs_item in categorized_summary:
            for b in cs_item.get("bullets", []):
                summary_lines.append(str(b))
        summary_lines = summary_lines[:10]

        # ── category_reports ──
        normalized_category_reports = _normalize_category_reports(
            parsed.get("category_reports", []), fallback_category_reports
        )

        # ── strategic_report ──
        raw_sr = parsed.get("strategic_report")
        if isinstance(raw_sr, dict):
            strategic_report = _normalize_strategic_report(raw_sr, fallback_strategic)
        else:
            strategic_report = fallback_strategic

        return {
            "summary_lines": summary_lines,
            "categorized_summary": categorized_summary,
            "category_reports": normalized_category_reports,
            "strategic_report": strategic_report,
            "usage": extract_usage_from_response(response, model_name),
            "is_fallback": False,
        }
    except Exception as e:
        logger.error("Error in summarize_daily_digest: %s", e, exc_info=True)
        return {
            "summary_lines": fallback_lines,
            "categorized_summary": fallback_payload.get("categorized_summary", _build_categorized_summary_fallback(article_payloads)),
            "category_reports": fallback_category_reports,
            "strategic_report": fallback_strategic,
            "usage": build_usage_payload(model_name=model_name, is_mock=True),
            "is_fallback": True,
        }


def _normalize_strategic_report(raw: Dict[str, Any], fallback: Dict[str, Any]) -> Dict[str, Any]:
    """Safely normalize the LLM-returned strategic_report, falling back field-by-field."""
    result: Dict[str, Any] = {}

    # executive_summary
    raw_es = raw.get("executive_summary")
    if isinstance(raw_es, dict):
        kws = raw_es.get("keywords", [])
        if isinstance(kws, str):
            kws = [k.strip() for k in kws.split(",") if k.strip()]
        result["executive_summary"] = {
            "core_message": str(raw_es.get("core_message", fallback["executive_summary"]["core_message"])),
            "keywords": kws if isinstance(kws, list) else fallback["executive_summary"]["keywords"],
            "sentiment_label": str(raw_es.get("sentiment_label", fallback["executive_summary"]["sentiment_label"])),
            "market_narrative": str(raw_es.get("market_narrative", fallback["executive_summary"]["market_narrative"])),
        }
    else:
        result["executive_summary"] = fallback["executive_summary"]

    # strategic_pillars
    raw_pillars = raw.get("strategic_pillars", [])
    pillars: List[Dict[str, str]] = []
    if isinstance(raw_pillars, list):
        for p in raw_pillars[:6]:
            if isinstance(p, dict) and p.get("theme"):
                pillars.append({
                    "theme": str(p.get("theme", "")),
                    "situation": str(p.get("situation", "")),
                    "implication": str(p.get("implication", "")),
                })
    result["strategic_pillars"] = pillars if pillars else fallback["strategic_pillars"]

    # high_value_signals
    raw_signals = raw.get("high_value_signals", [])
    signals: List[Dict[str, str]] = []
    if isinstance(raw_signals, list):
        for s in raw_signals[:6]:
            if isinstance(s, dict) and s.get("signal_type"):
                signals.append({
                    "signal_type": str(s.get("signal_type", "Watch")),
                    "description": str(s.get("description", "")),
                    "strategic_response": str(s.get("strategic_response", "")),
                })
    result["high_value_signals"] = signals if signals else fallback["high_value_signals"]

    # consultant_briefing
    raw_cb = raw.get("consultant_briefing")
    if isinstance(raw_cb, dict) and raw_cb.get("insight"):
        wl = raw_cb.get("watch_list", [])
        if isinstance(wl, str):
            wl = [w.strip() for w in wl.split(",") if w.strip()]
        result["consultant_briefing"] = {
            "insight": str(raw_cb.get("insight", "")),
            "watch_list": wl if isinstance(wl, list) else [],
        }
    else:
        result["consultant_briefing"] = fallback["consultant_briefing"]

    return result


# ═══════════════════════════════════════════════════════════════════════
#  Chatbot – answer questions based ONLY on crawled news data
# ═══════════════════════════════════════════════════════════════════════

async def answer_chatbot_question(
    question: str,
    news_context: str,
    source_count: int,
    history: List[tuple] | None = None,
) -> Dict[str, Any]:
    """
    Uses OpenAI to answer a user question strictly from the provided news context.
    Always returns exactly 3 bullet points.
    """
    client = get_openai_client()
    model_name = get_model_name()

    system_prompt = (
        "당신은 '테.읽.남.(테크 읽어주는 남자)' 기술 뉴스 전문 AI 어시스턴트입니다.\n"
        "아래 제공된 '크롤링된 뉴스 데이터'에 기반해서만 답변하세요.\n"
        "뉴스 데이터에 없는 내용은 절대 추측하거나 만들어내지 마세요.\n"
        "만약 질문에 대한 답변이 뉴스 데이터에 없다면, '현재 수집된 뉴스에서 해당 정보를 찾을 수 없습니다'라고 답하세요.\n\n"
        "【답변 형식 규칙 – 반드시 준수】\n"
        "- 반드시 정확히 3개의 불릿 포인트(•)로 답변하세요.\n"
        "- 각 불릿은 '• '로 시작하세요.\n"
        "- 핵심 정보를 간결하고 명확하게 정리하세요.\n"
        "- 한국어로 답변하세요.\n\n"
        "【크롤링된 뉴스 데이터】\n"
        f"{news_context}"
    )

    if not client:
        # Fallback when no API key is configured
        return {
            "answer": (
                "• OpenAI API 키가 설정되지 않아 AI 답변을 생성할 수 없습니다.\n"
                "• .env 파일에 OPENAI_API_KEY를 설정한 후 백엔드를 재시작해 주세요.\n"
                f"• 현재 {source_count}건의 뉴스 데이터가 준비되어 있습니다."
            ),
            "source_count": source_count,
            "generated_with_model": False,
        }

    messages: list = [{"role": "system", "content": system_prompt}]

    # Append conversation history (last 6 turns max to stay within context)
    if history:
        for role, content in history[-6:]:
            if role in ("user", "assistant"):
                messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": question})

    try:
        # Some models do not support `temperature` or
        # `max_tokens`.  They also consume reasoning tokens internally,
        # so we need a generous max_completion_tokens budget (reasoning +
        # visible output combined).  4096 gives ample room.
        response = await client.chat.completions.create(
            model=model_name,
            messages=messages,
            max_completion_tokens=4096,
        )
        raw_answer = response.choices[0].message.content or ""

        # Ensure exactly 3 bullet points
        answer = _normalize_chatbot_bullets(raw_answer)

        return {
            "answer": answer,
            "source_count": source_count,
            "generated_with_model": True,
        }
    except Exception as e:
        logger.error("Chatbot LLM error: %s", e, exc_info=True)
        return {
            "answer": (
                "• AI 모델 호출 중 오류가 발생했습니다.\n"
                f"• 오류 내용: {str(e)[:100]}\n"
                "• 잠시 후 다시 시도해 주세요."
            ),
            "source_count": source_count,
            "generated_with_model": False,
        }


def _normalize_chatbot_bullets(raw: str) -> str:
    """Ensure the chatbot answer has exactly 3 bullet points starting with •."""
    lines = [line.strip() for line in raw.strip().split("\n") if line.strip()]
    bullets: list[str] = []
    for line in lines:
        # Normalize various bullet formats
        cleaned = line.lstrip("-*•● ").strip()
        if cleaned:
            bullets.append(f"• {cleaned}")
    # Pad or trim to exactly 3
    while len(bullets) < 3:
        bullets.append("• 추가 관련 정보는 뉴스 목록에서 직접 확인해 주세요.")
    return "\n".join(bullets[:3])
