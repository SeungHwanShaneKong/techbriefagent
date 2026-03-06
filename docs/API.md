# API 레퍼런스 (API Reference)

## 기본 정보

- **Base URL**: `http://localhost:8000`
- **Content-Type**: `application/json`
- **CORS**: `http://localhost:5173`, `http://localhost:8501` (환경변수로 설정 가능)
- **API 문서 (Swagger UI)**: `http://localhost:8000/docs`

---

## 1. GET /api/stats

대시보드 히트맵 및 워드 클라우드를 위한 통계 데이터를 반환합니다. 최근 48시간 기준으로 집계됩니다.

### 요청 파라미터

없음

### 응답 스키마

```json
{
  "total_articles": 150,
  "categories": {
    "AI": 45,
    "Semiconductor": 30,
    "General Tech": 25,
    "Robotics": 20,
    "Blockchain": 15,
    "Bio-tech": 15
  },
  "recent_keywords": ["AI", "GPU", "OpenAI", "Apple", "반도체", "..."],
  "usage": {
    "current_model": "gpt-4o-mini",
    "total_requests": 320,
    "prompt_tokens": 450000,
    "completion_tokens": 85000,
    "total_tokens": 535000,
    "total_estimated_cost_usd": 0.118500,
    "total_estimated_cost_krw": 160,
    "usd_to_krw_rate": 1350.0,
    "input_cost_per_1m": 0.15,
    "output_cost_per_1m": 0.60
  },
  "daily_cost": [
    { "date": "2025-01-14", "cost_usd": 0.045 },
    { "date": "2025-01-15", "cost_usd": 0.073 }
  ]
}
```

### 응답 필드 설명

| 필드 | 타입 | 설명 |
|---|---|---|
| `total_articles` | int | 최근 48시간 기사 수 |
| `categories` | object | 카테고리별 기사 수 |
| `recent_keywords` | string[] | 최근 50개 요약의 키워드 목록 (중복 포함) |
| `usage.current_model` | string | 현재 사용 중인 LLM 모델명 |
| `usage.total_requests` | int | 누적 LLM API 호출 수 |
| `usage.total_estimated_cost_usd` | float | 누적 추정 비용 (USD) |
| `usage.total_estimated_cost_krw` | int | 누적 추정 비용 (KRW) |
| `daily_cost` | array | 최근 14일간 일별 비용 추이 |

---

## 2. GET /api/news

기사 목록을 페이지네이션으로 조회합니다. 날짜, 카테고리, 키워드 필터를 지원합니다.

### 요청 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---|---|---|---|---|
| `skip` | int | X | 0 | 건너뛸 기사 수 (offset) |
| `limit` | int | X | 50 | 반환할 기사 수 (최대) |
| `category` | string | X | - | 카테고리 필터 (예: "AI", "Semiconductor") |
| `keyword` | string | X | - | 키워드 검색 (제목 또는 요약 키워드에서 LIKE 검색) |
| `target_date` | string | X | - | 조회 대상 날짜 (YYYY-MM-DD). 미지정 시 최근 48시간 |

### 요청 예시

```
GET /api/news?target_date=2025-01-15&category=AI&limit=20
GET /api/news?keyword=OpenAI&skip=0&limit=50
```

### 응답 스키마

```json
{
  "items": [
    {
      "id": 1234,
      "title": "OpenAI Launches New GPT-5 Model",
      "original_url": "https://techcrunch.com/2025/01/15/openai-gpt5",
      "publisher": "TechCrunch",
      "pub_date": "2025-01-15T14:30:00",
      "category": "AI",
      "raw_content": "OpenAI has announced...",
      "created_at": "2025-01-15T23:45:00",
      "summary": {
        "id": 1001,
        "article_id": 1234,
        "summary_text": "1. OpenAI가 GPT-5 모델을 공개했습니다.\n2. 멀티모달 성능이 크게 향상되었습니다.\n3. 기업용 API 요금은 기존 대비 30% 인하됩니다.",
        "keywords": "OpenAI, GPT-5, 멀티모달, AI",
        "sentiment_score": 78.5,
        "translated_title": "OpenAI, 새로운 GPT-5 모델 출시"
      }
    }
  ],
  "total": 45,
  "skip": 0,
  "limit": 20,
  "has_more": true
}
```

### 응답 필드 설명

| 필드 | 타입 | 설명 |
|---|---|---|
| `items` | NewsArticle[] | 기사 목록 |
| `items[].summary` | AISummary / null | AI 분석 결과 (없을 수 있음) |
| `items[].summary.sentiment_score` | float | 감성 점수 (0=매우 부정, 50=중립, 100=매우 긍정) |
| `total` | int | 필터 조건에 맞는 전체 기사 수 |
| `has_more` | bool | 추가 페이지 존재 여부 |

---

## 3. GET /api/news-dates

데이터가 존재하는 날짜 목록과 각 날짜의 기사 수를 반환합니다.

### 요청 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---|---|---|---|---|
| `limit` | int | X | 90 | 반환할 최대 일자 수 (1~365) |

### 요청 예시

```
GET /api/news-dates?limit=30
```

### 응답 스키마

```json
[
  { "date": "2025-01-15", "article_count": 87 },
  { "date": "2025-01-14", "article_count": 102 },
  { "date": "2025-01-13", "article_count": 65 }
]
```

### 응답 필드 설명

| 필드 | 타입 | 설명 |
|---|---|---|
| `date` | string | 날짜 (YYYY-MM-DD) |
| `article_count` | int | 해당 날짜의 기사 수 |

---

## 4. GET /api/daily-brief

선택한 날짜의 일일 브리핑 리포트를 생성합니다. AI 모델을 사용한 종합 요약, 카테고리별 리포트, 전략 인텔리전스 리포트를 포함합니다.

### 요청 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---|---|---|---|---|
| `target_date` | string | O | - | 대상 날짜 (YYYY-MM-DD) |

### 요청 예시

```
GET /api/daily-brief?target_date=2025-01-15
```

### 응답 스키마

```json
{
  "target_date": "2025-01-15",
  "total_articles": 87,
  "unique_publishers": 18,
  "average_sentiment": 62.34,
  "top_categories": {
    "AI": 32,
    "General Tech": 20,
    "Semiconductor": 15,
    "Robotics": 12,
    "Blockchain": 8
  },
  "top_keywords": ["AI", "GPU", "OpenAI", "Apple", "반도체", "클라우드", "보안", "자율주행", "LLM", "투자"],
  "summary_lines": [
    "AI 분야에서 OpenAI GPT-5 출시로 멀티모달 AI 경쟁이 본격화...",
    "반도체 업계에서 TSMC 3nm 공정 수율 개선 소식이 전해졌습니다...",
    "..."
  ],
  "categorized_summary": [
    {
      "category": "AI/인공지능",
      "bullets": [
        "OpenAI가 GPT-5를 공개하며 멀티모달 성능이 크게 향상...",
        "Google DeepMind의 새로운 연구가 AI 안전성 분야에서..."
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
      "article_count": 32,
      "average_sentiment": 68.5,
      "key_topics": ["GPT-5", "멀티모달", "AI 안전성"],
      "executive_summary": "AI 분야에서 OpenAI GPT-5 출시가 최대 이슈..."
    }
  ],
  "generated_with_model": true,
  "strategic_report": {
    "executive_summary": {
      "core_message": "오늘의 기술 뉴스 핵심 메시지...",
      "keywords": ["#AI", "#반도체", "#클라우드"],
      "sentiment_label": "긍정 62.3/100",
      "market_narrative": "기술 시장 전반의 흐름 설명..."
    },
    "strategic_pillars": [
      {
        "theme": "AI 기술 성숙도 가속",
        "situation": "GPT-5 출시로 AI 성능 경쟁이...",
        "implication": "기업의 AI 도입 전략 재검토가..."
      }
    ],
    "high_value_signals": [
      {
        "signal_type": "주의 필요",
        "description": "AI 규제 강화 움직임이...",
        "strategic_response": "컴플라이언스 대비를..."
      },
      {
        "signal_type": "새로운 기회",
        "description": "엣지 AI 시장이 급성장하며...",
        "strategic_response": "파일럿 프로젝트를 통해..."
      }
    ],
    "consultant_briefing": {
      "insight": "오늘의 종합 분석 인사이트...",
      "watch_list": ["AI 규제 동향", "반도체 공급망", "클라우드 가격 전쟁"]
    }
  }
}
```

### 주요 응답 필드 설명

| 필드 | 타입 | 설명 |
|---|---|---|
| `total_articles` | int | 해당 날짜의 총 기사 수 |
| `unique_publishers` | int | 고유 발행 매체 수 |
| `average_sentiment` | float | 평균 감성 점수 (0~100) |
| `top_categories` | object | 상위 5개 카테고리별 기사 수 |
| `top_keywords` | string[] | 상위 10개 키워드 |
| `summary_lines` | string[] | 10줄 요약 (backward compatibility) |
| `categorized_summary` | array | 5개 카테고리 x 2 bullet 요약 |
| `category_reports` | array | 카테고리별 상세 리포트 |
| `generated_with_model` | bool | AI 모델로 생성 여부 (false=fallback) |
| `strategic_report` | object/null | 전략 인텔리전스 리포트 |

### 에러 응답

| 코드 | 상황 | 응답 |
|---|---|---|
| 400 | 잘못된 날짜 형식 | `{"detail": "target_date must be YYYY-MM-DD format"}` |

---

## 5. POST /api/crawl

백그라운드 크롤링 작업을 실행합니다. 목표 기사 수에 도달할 때까지 반복 수집합니다.

### 요청 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---|---|---|---|---|
| `min_articles` | int (query) | X | 100 | 목표 최소 기사 수 (1~5000) |

### 요청 예시

```
POST /api/crawl?min_articles=120
```

### 응답 스키마

```json
{
  "status": "배경 수집 시작: 최소 120건 달성까지 반복 수집",
  "new_articles_count": 0,
  "summarized_count": 0
}
```

### 에러 응답

| 코드 | 상황 | 응답 |
|---|---|---|
| 429 | Rate limit 초과 (30초 쿨다운) | `{"detail": "너무 빠른 요청입니다. N초 후 다시 시도해 주세요."}` |

### 이미 실행 중인 경우

```json
{
  "status": "이미 수집 작업이 실행 중입니다. (현재 85건 / 목표 120건)",
  "new_articles_count": 0,
  "summarized_count": 45
}
```

---

## 6. GET /api/crawl-status

현재 크롤링 작업의 진행 상태를 반환합니다.

### 요청 파라미터

없음

### 응답 스키마

```json
{
  "is_running": true,
  "target_min_articles": 120,
  "current_recent_articles": 85,
  "total_cycles": 2,
  "total_summarized": 45,
  "cycle_target_articles": 30,
  "cycle_processed_articles": 18,
  "current_phase": "collecting",
  "collection_progress_pct": 70.83,
  "analysis_progress_pct": 52.94,
  "pending_analysis_count": 12,
  "degraded_summary_count": 3,
  "started_at": "2025-01-15T14:30:00",
  "updated_at": "2025-01-15T14:35:22",
  "message": "최소 기사 수 목표 달성을 위한 반복 수집 시작"
}
```

### 응답 필드 설명

| 필드 | 타입 | 설명 |
|---|---|---|
| `is_running` | bool | 크롤링 작업 실행 중 여부 |
| `target_min_articles` | int | 목표 최소 기사 수 |
| `current_recent_articles` | int | 현재 수집된 최근 기사 수 |
| `current_phase` | string | 현재 단계: `idle`, `collecting`, `analysis_verify`, `analysis_repair`, `completed`, `error` |
| `collection_progress_pct` | float | 수집 진행률 (0~100%) |
| `analysis_progress_pct` | float | 분석 진행률 (0~100%) |
| `pending_analysis_count` | int | 미분석 기사 수 |
| `degraded_summary_count` | int | 저품질/모의 요약 수 |
| `message` | string | 사용자용 상태 메시지 (한국어) |

---

## 7. POST /api/repair-analysis

누락되거나 저품질인 AI 요약을 자동 재분석합니다.

### 요청 파라미터

없음

### 요청 예시

```
POST /api/repair-analysis
```

### 응답 스키마

```json
{
  "status": "분석 보정 작업 시작: 누락/모의 요약을 자동 재분석합니다.",
  "new_articles_count": 0,
  "summarized_count": 0
}
```

### 이미 실행 중인 경우

```json
{
  "status": "다른 수집/분석 작업이 실행 중입니다. 완료 후 다시 시도해 주세요.",
  "new_articles_count": 0,
  "summarized_count": 0
}
```

---

## 8. POST /api/chatbot

수집된 뉴스 데이터를 기반으로 AI 챗봇이 질문에 답변합니다. 항상 정확히 3개의 bullet point로 응답합니다.

### 요청 본문 (JSON)

```json
{
  "question": "최근 AI 관련 주요 뉴스는?",
  "history": [
    { "role": "user", "content": "이전 질문" },
    { "role": "assistant", "content": "이전 답변" }
  ]
}
```

### 요청 필드 설명

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `question` | string | O | 사용자 질문 |
| `history` | ChatMessage[] | X | 대화 이력 (최근 6턴까지 사용) |

### 응답 스키마

```json
{
  "answer": "• OpenAI가 GPT-5를 공개하며 멀티모달 AI 시대의 서막을 열었습니다.\n• Google DeepMind는 새로운 AI 안전성 프레임워크를 발표했습니다.\n• Meta는 오픈소스 AI 모델 Llama 4를 출시할 예정입니다.",
  "source_count": 87,
  "generated_with_model": true
}
```

### 응답 필드 설명

| 필드 | 타입 | 설명 |
|---|---|---|
| `answer` | string | 3개 bullet point 답변 (한국어, 각 줄 "• "로 시작) |
| `source_count` | int | 참조한 뉴스 데이터 수 |
| `generated_with_model` | bool | AI 모델 생성 여부 (false=fallback) |

### 에러 응답

| 코드 | 상황 | 응답 |
|---|---|---|
| 400 | 빈 질문 | `{"detail": "질문을 입력해 주세요."}` |

### 뉴스 데이터 없는 경우

```json
{
  "answer": "• 현재 수집된 뉴스 데이터가 없습니다.\n• 좌측 패널에서 '수집' 버튼을 눌러 뉴스를 먼저 크롤링해 주세요.\n• 크롤링 완료 후 다시 질문해 주시면 정확한 답변을 드리겠습니다.",
  "source_count": 0,
  "generated_with_model": false
}
```

---

## 9. WebSocket /ws/logs

실시간 로그 스트리밍을 위한 WebSocket 엔드포인트입니다.

### 연결

```
ws://localhost:8000/ws/logs
```

### 수신 메시지 형식

```json
{
  "type": "log",
  "level": "info",
  "message": "크롤링 진행 중: TechCrunch 15건 수집",
  "timestamp": "2025-01-15T14:35:22.123456"
}
```

### Keep-alive

60초 간격으로 ping 메시지를 전송합니다:

```json
{
  "type": "ping"
}
```

---

## 공통 에러 응답

### HTTP 에러 코드

| 코드 | 설명 |
|---|---|
| 400 | 잘못된 요청 파라미터 |
| 422 | 요청 유효성 검사 실패 (Pydantic ValidationError) |
| 429 | Rate limit 초과 (크롤링 30초 쿨다운) |
| 500 | 서버 내부 오류 |

### 에러 응답 형식

```json
{
  "detail": "에러 메시지"
}
```

유효성 검사 에러 (422)의 경우:

```json
{
  "detail": [
    {
      "loc": ["query", "min_articles"],
      "msg": "ensure this value is greater than or equal to 1",
      "type": "value_error.number.not_ge"
    }
  ]
}
```
