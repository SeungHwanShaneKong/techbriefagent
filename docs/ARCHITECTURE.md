# 시스템 아키텍처 (System Architecture)

## 시스템 개요

테.읽.남.(Tech News Hub)은 글로벌 기술 뉴스를 자동으로 수집하고 AI를 통해 분석한 뒤, 대시보드 형태로 시각화하는 풀스택 애플리케이션입니다.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (React 18)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ StatCards │  │ Overview │  │  Daily   │  │   Articles Tab   │   │
│  │  (통계)   │  │Tab(현황) │  │Report Tab│  │  (기사 분석)      │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Chatbot (AI 대화)                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                        Axios HTTP Client                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │ REST API (JSON)
                             │ WebSocket (/ws/logs)
┌────────────────────────────┴────────────────────────────────────────┐
│                      Backend (FastAPI)                              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    API Layer (main.py)                        │  │
│  │  /api/stats  /api/news  /api/daily-brief  /api/crawl  ...   │  │
│  └──────┬───────────┬───────────┬───────────┬──────────────────┘  │
│         │           │           │           │                      │
│  ┌──────┴───┐ ┌─────┴────┐ ┌───┴─────┐ ┌──┴──────────┐          │
│  │ Database │ │  Crawler  │ │   LLM   │ │  Schemas    │          │
│  │ (SQLAlch)│ │(feedparser│ │ Service │ │  (Pydantic) │          │
│  │          │ │+Playwright│ │ (OpenAI)│ │             │          │
│  │          │ │+BS4)      │ │         │ │             │          │
│  └──────┬───┘ └──────────┘ └─────────┘ └─────────────┘          │
│         │                                                         │
│  ┌──────┴──────────────────────────────────────────────────────┐  │
│  │                 SQLite (WAL Mode)                            │  │
│  │  news_articles / ai_summaries / llm_usage_logs              │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

## 데이터 플로우

### 1. 뉴스 수집 파이프라인

```
RSS Feeds (24개 소스)
        │
        ▼
┌───────────────────┐
│  feedparser       │  RSS/Atom 피드 파싱
│  (병렬 8스레드)    │  ThreadPoolExecutor 사용
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  Playwright +     │  원문 본문 크롤링
│  BeautifulSoup4   │  (JavaScript 렌더링 지원)
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  SQLite DB        │  NewsArticle 레코드 저장
│  (중복 URL 체크)   │  original_url UNIQUE 제약
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  OpenAI API       │  기사별 AI 분석
│  (gpt-4o-mini)    │  요약/키워드/감성/번역/카테고리
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  AISummary +      │  분석 결과 저장
│  LLMUsageLog      │  토큰/비용 추적
└───────────────────┘
```

### 2. 대시보드 데이터 플로우

```
사용자 (브라우저)
        │
        ▼
┌───────────────────┐
│  React App        │  3초 주기 자동 새로고침
│  (폴링 기반)       │  silentRefresh()
└───────┬───────────┘
        │ fetchStats(), fetchNews(), fetchDailyBrief()
        ▼
┌───────────────────┐
│  FastAPI          │  날짜/카테고리/키워드 필터링
│  REST Endpoints   │  페이지네이션 지원
└───────┬───────────┘
        │ SQLAlchemy ORM 쿼리
        ▼
┌───────────────────┐
│  SQLite           │  48시간 기본 윈도우
│  (WAL 모드)       │  날짜 지정 시 일자별 조회
└───────────────────┘
```

### 3. 일일 브리핑 생성 플로우

```
GET /api/daily-brief?target_date=2025-01-15
        │
        ▼
┌───────────────────┐
│  캐시 확인         │  LRU 캐시 (최대 7개 엔트리)
│  cache_key 생성    │  key = date:count:latest_id:summary_count:max_summary_id
└───────┬───────────┘
        │ (캐시 미스)
        ▼
┌───────────────────┐
│  기사 데이터 집계  │  카테고리/키워드/감성 통계
│                    │  발행사(publisher) 집계
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  OpenAI API       │  종합 분석 리포트 생성
│  (JSON Mode)      │  categorized_summary (5개 카테고리 x 2 bullet)
│                    │  category_reports (카테고리별 상세)
│                    │  strategic_report (전략 리포트)
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  정규화 + 캐싱     │  결과 정규화 후 캐시 저장
│                    │  LLM 사용량 DB 기록
└───────────────────┘
```

## Frontend 컴포넌트 트리

```
App
├── Toast                           # 토스트 알림 (전역)
├── Header                          # 상단 헤더
│   ├── 로고 + 제목
│   ├── 자동 새로고침 토글
│   ├── 다크 모드 토글
│   └── 모바일 사이드바 햄버거 메뉴
├── StatCards                       # 통계 카드 (4개 KPI)
│   ├── 총 기사 수 (48h)
│   ├── 카테고리 수
│   ├── 평균 감성 지수
│   └── LLM 비용 (USD/KRW)
├── Sidebar                         # 좌측 사이드바 (lg:col-span-3)
│   ├── 크롤링 제어 패널
│   │   ├── 목표 기사 수 슬라이더
│   │   ├── 수집 시작 버튼
│   │   ├── 분석 보정 버튼
│   │   └── 진행률 표시 (collection / analysis)
│   ├── 날짜 선택 목록
│   ├── 카테고리 필터
│   └── 키워드 검색
├── Tabs (main content area, lg:col-span-9)
│   ├── OverviewTab (운영 현황)
│   │   ├── CategoryBarChart        # 카테고리 분포 막대 차트
│   │   ├── CostAreaChart           # 일별 LLM 비용 추이
│   │   └── KeywordCloud            # 키워드 빈도 클라우드
│   ├── DailyReportTab (일일 리포트)
│   │   ├── 전략 리포트 (Strategic Report)
│   │   │   ├── Executive Summary
│   │   │   ├── Strategic Pillars
│   │   │   ├── High Value Signals
│   │   │   └── Consultant Briefing
│   │   ├── 카테고리별 요약 (5 categories x 2 bullets)
│   │   └── 카테고리별 상세 리포트
│   └── ArticlesTab (기사 분석)
│       ├── ArticleCard (개별 기사)  # 아코디언 확장
│       │   ├── 제목 + 번역 제목
│       │   ├── AI 요약 (3줄)
│       │   ├── 키워드 칩
│       │   └── 감성 점수 바
│       └── 무한 스크롤 (IntersectionObserver)
└── Chatbot                         # 플로팅 챗봇
    ├── 질문 입력
    ├── 대화 이력 (최근 6턴)
    └── 3줄 bullet 응답
```

## 데이터베이스 스키마

### news_articles (뉴스 기사)

| 컬럼명 | 타입 | 설명 |
|---|---|---|
| id | INTEGER (PK) | 기사 고유 ID |
| title | VARCHAR(500) | 기사 제목 |
| original_url | VARCHAR(1000) | 원문 URL (UNIQUE) |
| publisher | VARCHAR(100) | 발행 매체명 |
| pub_date | DATETIME | 발행 일시 |
| category | VARCHAR(100) | 카테고리 (AI, Robotics, Bio-tech, Semiconductor, Blockchain, General Tech) |
| raw_content | TEXT | 크롤링된 본문 텍스트 |
| created_at | DATETIME | 레코드 생성 시각 (KST) |

**인덱스**:
- `ix_news_pub_date` -- pub_date
- `ix_news_category` -- category
- `ix_news_pub_category` -- pub_date + category (복합)
- `ix_news_articles_original_url` -- original_url (UNIQUE)
- `ix_news_articles_title` -- title

### ai_summaries (AI 요약)

| 컬럼명 | 타입 | 설명 |
|---|---|---|
| id | INTEGER (PK) | 요약 고유 ID |
| article_id | INTEGER (FK, UNIQUE) | 연관 기사 ID |
| summary_text | TEXT | AI 생성 3줄 요약 (한국어) |
| keywords | VARCHAR(500) | 쉼표 구분 키워드 |
| sentiment_score | FLOAT | 감성 점수 (0~100, 50=중립) |
| translated_title | VARCHAR(500) | 기사 제목 한국어 번역 |

**관계**: NewsArticle 1:1 AISummary (cascade delete)

### llm_usage_logs (LLM 사용 로그)

| 컬럼명 | 타입 | 설명 |
|---|---|---|
| id | INTEGER (PK) | 로그 고유 ID |
| article_id | INTEGER (FK, nullable) | 연관 기사 ID (일일 브리핑은 NULL) |
| model_name | VARCHAR(100) | 사용 모델명 (예: gpt-4o-mini) |
| prompt_tokens | INTEGER | 입력 토큰 수 |
| completion_tokens | INTEGER | 출력 토큰 수 |
| total_tokens | INTEGER | 총 토큰 수 |
| estimated_cost_usd | FLOAT | 추정 비용 (USD) |
| created_at | DATETIME | 요청 시각 (KST) |

**인덱스**: `ix_llm_created` -- created_at

## 주요 설계 결정

### 1. SQLite WAL 모드

```python
cursor.execute("PRAGMA journal_mode=WAL")
cursor.execute("PRAGMA synchronous=NORMAL")
cursor.execute("PRAGMA busy_timeout=5000")
```

- **이유**: 단일 서버 배포 환경에서 PostgreSQL 대비 운영 복잡도 감소
- **WAL (Write-Ahead Logging)**: 읽기-쓰기 동시성 개선, 크롤링 백그라운드 작업과 API 읽기가 충돌하지 않음
- **busy_timeout=5000**: 락 경합 시 최대 5초 대기 후 재시도

### 2. 병렬 크롤링 (ThreadPoolExecutor)

- 24개 RSS 피드를 `ThreadPoolExecutor`로 병렬 수집
- 피드당 랜덤 딜레이 (0.4~1.4초)로 서버 부하 분산
- `requests.Session`에 자동 재시도 (Retry) 적용: 429, 5xx 에러 자동 재시도
- Playwright를 통한 JavaScript 렌더링 지원 (SPA 사이트 대응)

### 3. LLM Fallback 전략

- OpenAI API 키 미설정 시 mock 응답 반환 (파이프라인 중단 방지)
- API 호출 실패 시 결정론적(deterministic) fallback 로직으로 대체
- 일일 브리핑: `build_daily_digest_fallback()` -- 기사 데이터 기반 통계적 요약 생성
- 전략 리포트: `build_strategic_report_fallback()` -- 카테고리/키워드 빈도 기반 리포트

### 4. 일일 브리핑 캐시

- LRU 방식 인메모리 캐시 (최대 7개 엔트리)
- 캐시 키: `{target_date}:{article_count}:{latest_article_id}:{summary_count}:{max_summary_id}`
- 새 기사/요약 추가 시 자연스럽게 캐시 무효화
- 크롤링 완료 시 전체 캐시 클리어 (`DAILY_BRIEF_CACHE.clear()`)

### 5. 크롤링 상태 관리

- 전역 딕셔너리 `CRAWL_JOB_STATE` + `Lock`으로 스레드 안전한 상태 추적
- 3단계 파이프라인: 수집(collecting) -> 분석 검증(analysis_verify) -> 모의 요약 교정(analysis_repair)
- 진행률 콜백(`progress_callback`)으로 실시간 상태 업데이트
- Rate limiting: 30초 쿨다운으로 중복 크롤링 방지

### 6. Frontend 실시간 업데이트

- 3초 주기 `silentRefresh()` (백그라운드 데이터 갱신)
- 크롤링 종료 감지 시 전체 데이터 리로드
- `IntersectionObserver` 기반 무한 스크롤 (기사 목록)
- 날짜 변경 시 즉시 로딩 표시 + 데이터 교체

### 7. 비용 추적 시스템

- 모든 LLM API 호출의 토큰 사용량/비용을 `LLMUsageLog`에 기록
- 모델별 가격표 내장 (`MODEL_PRICING` 딕셔너리)
- USD -> KRW 환산 표시 (환율 환경변수로 설정)
- 일별 비용 추이 차트 제공

### 8. 카테고리 분류 체계

AI가 기사를 6개 카테고리로 자동 분류합니다:

| 카테고리 | 설명 |
|---|---|
| AI | 인공지능, 머신러닝, LLM 관련 |
| Robotics | 로봇공학, 자율시스템 |
| Bio-tech | 바이오테크, 의료 기술 |
| Semiconductor | 반도체, 칩 설계, 하드웨어 |
| Blockchain | 블록체인, 암호화폐, Web3 |
| General Tech | 기타 기술 뉴스 전반 |

일일 리포트에서는 5개 분석 카테고리로 재그룹합니다:
- AI/인공지능
- 반도체/하드웨어
- 소프트웨어/클라우드
- 비즈니스/산업
- 보안/규제
