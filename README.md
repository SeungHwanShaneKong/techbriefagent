# 테.읽.남. (Tech News Hub) - AI 뉴스 인텔리전스 대시보드

> 테크 읽어주는 남자 -- AI 기반 기술 뉴스 자동 수집/분석/리포팅 시스템

## 주요 기능

- **자동 뉴스 수집**: RSS 기반 글로벌 기술 뉴스 병렬 크롤링 (24개 피드 소스, 8개 동시 처리)
- **AI 분석**: OpenAI GPT 모델을 활용한 자동 요약/번역/감성분석/키워드 추출
- **전략 리포트**: 일일 전략 인텔리전스 브리핑 자동 생성 (Strategic Intelligence Report)
- **대화형 AI**: 수집된 뉴스 기반 3줄 요약 챗봇
- **실시간 대시보드**: React + Recharts 기반 운영 현황 모니터링
- **다크 모드**: 시스템/수동 다크 모드 지원

## 기술 스택

### Backend
- Python 3.10+ / FastAPI 0.115
- SQLAlchemy 2.0 ORM + SQLite (WAL 모드)
- OpenAI API (gpt-4o-mini 기본, gpt-4o/gpt-4-turbo 지원)
- Playwright + BeautifulSoup4 + feedparser (크롤링)
- Alembic (DB 마이그레이션)
- httpx / requests (HTTP 클라이언트)

### Frontend
- React 18 + TypeScript 5.9
- Vite 7 (빌드 도구)
- Tailwind CSS 3.4 + Radix UI primitives
- Recharts 3.7 (차트 시각화)
- Axios (HTTP 클라이언트)
- dayjs (날짜 처리)
- Lucide React (아이콘)

## 빠른 시작

### 1. 환경 설정

```bash
cp env.example .env
# .env 파일을 열어 OPENAI_API_KEY를 입력하세요
```

### 2. Backend 실행

```bash
pip install -r requirements.txt
playwright install chromium
uvicorn backend.main:app --reload --port 8000
```

### 3. Frontend 실행

```bash
cd frontend
npm install
npm run dev
```

### 4. Docker (선택사항)

```bash
docker-compose up --build
```

Docker 환경에서는 Backend가 8000번 포트, Frontend가 8501번 포트로 실행됩니다.

## 프로젝트 구조

```
PJT_techbriefagent/
├── backend/
│   ├── main.py              # FastAPI 엔드포인트 + 미들웨어
│   ├── models.py            # SQLAlchemy ORM 모델
│   ├── schemas.py           # Pydantic 요청/응답 스키마
│   ├── database.py          # DB 엔진 및 세션 설정
│   ├── crawler.py           # RSS 크롤링 및 콘텐츠 수집
│   ├── llm_service.py       # OpenAI API 연동 (요약/분석/챗봇)
│   ├── logging_config.py    # 구조화된 로깅 + 파일 로테이션
│   ├── startup_check.py     # 환경변수 유효성 검증
│   ├── Dockerfile
│   └── tests/
│       ├── conftest.py
│       ├── test_api.py
│       ├── test_models.py
│       ├── test_crawler.py      # 크롤러 유닛 테스트
│       └── test_llm_service.py  # LLM 서비스 유닛 테스트
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # 메인 애플리케이션 컴포넌트
│   │   ├── api.ts            # API 클라이언트 (재시도/인터셉터)
│   │   ├── types.ts          # TypeScript 타입 정의
│   │   ├── constants.ts      # 상수 및 유틸리티
│   │   ├── hooks/            # 커스텀 React 훅
│   │   ├── utils/
│   │   │   ├── reportBuilder.ts   # HTML 리포트 생성기
│   │   │   └── formatters.ts      # 날짜/숫자 포맷 유틸리티
│   │   ├── __tests__/             # 프론트엔드 테스트
│   │   └── components/
│   │       ├── Chatbot.tsx             # AI 챗봇 컴포넌트
│   │       ├── layout/
│   │       │   ├── Header.tsx          # 헤더 (자동 새로고침, 다크 모드)
│   │       │   └── Sidebar.tsx         # 사이드바 (크롤링 제어, 필터)
│   │       ├── dashboard/
│   │       │   ├── StatCards.tsx        # 통계 카드 (상단 지표)
│   │       │   ├── OverviewTab.tsx      # 운영 현황 탭
│   │       │   ├── DailyReportTab.tsx   # 일일 리포트 탭
│   │       │   ├── ArticlesTab.tsx      # 기사 분석 탭
│   │       │   └── ArticleCard.tsx      # 개별 기사 카드
│   │       ├── charts/
│   │       │   ├── CategoryBarChart.tsx # 카테고리 분포 차트
│   │       │   ├── CostAreaChart.tsx    # 비용 추이 차트
│   │       │   └── KeywordCloud.tsx     # 키워드 클라우드
│   │       ├── common/
│   │       │   ├── Toast.tsx            # 토스트 알림
│   │       │   ├── ErrorBoundary.tsx    # 에러 바운더리
│   │       │   └── Skeleton.tsx         # 스켈레톤 로딩 UI
│   │       └── ui/                      # Radix UI 기반 공통 컴포넌트
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── Dockerfile
├── docs/
│   ├── ENV_REFERENCE.md      # 환경변수 레퍼런스
│   └── TROUBLESHOOTING.md    # 트러블슈팅 가이드
├── alembic/                  # DB 마이그레이션 설정
├── docker-compose.yml
├── requirements.txt          # 프로덕션 의존성
├── requirements-dev.txt      # 개발 도구 (테스트, 린터)
├── env.example               # 환경 변수 템플릿
├── CHANGELOG.md              # 변경 이력
├── turn_on.bat               # Windows 실행 스크립트
├── turn_off.bat              # Windows 종료 스크립트
└── pytest.ini                # pytest 설정
```

## API 요약

| Endpoint | Method | 설명 |
|---|---|---|
| `/api/stats` | GET | 대시보드 통계 (기사 수, 카테고리, 키워드, LLM 비용) |
| `/api/news` | GET | 기사 목록 조회 (페이지네이션, 필터링) |
| `/api/news-dates` | GET | 데이터 보유 일자 목록 |
| `/api/daily-brief` | GET | 일일 브리핑 리포트 (AI 요약 + 전략 리포트) |
| `/api/crawl` | POST | 크롤링 실행 (목표 기사 수 지정) |
| `/api/crawl-status` | GET | 크롤링 작업 진행 상태 |
| `/api/repair-analysis` | POST | 분석 보정 (누락/저품질 요약 재분석) |
| `/api/chatbot` | POST | AI 챗봇 질문 (3줄 요약 응답) |
| `/ws/logs` | WebSocket | 실시간 로그 스트리밍 |

## RSS 피드 소스

총 24개 글로벌 기술 미디어에서 뉴스를 수집합니다:

- **Tier 1** (주요 글로벌 테크): TechCrunch, Wired, The Verge, VentureBeat, Ars Technica, MIT Technology Review, ZDNet, Engadget, IEEE Spectrum, InfoQ, Android Authority
- **Tier 2** (하드웨어/모바일): Tom's Hardware, 9to5Google, 9to5Mac, MacRumors, The Next Web, SlashGear
- **Tier 3** (AI/엔터프라이즈): TechRadar, CNET, Gizmodo, Mashable, The Register
- **Tier 4** (딥테크/과학): Hacker News, Digital Trends, ScienceDaily Tech

## 라이선스

Private
