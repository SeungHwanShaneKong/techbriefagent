# Changelog

All notable changes to the Tech News Intelligence Hub are documented here.

## [3.0.0] - Phase 3: 36-Point Upgrade

### Infrastructure (Agent 1)
- `.gitignore` 및 `.dockerignore` 보강 (DB, 캐시, 빌드 산출물 추가)
- `requirements-dev.txt` 분리 (테스트/린트 도구를 프로덕션에서 제거)
- `env.example` 한국어 주석 상세화 및 `startup_check.py` 환경 검증

### Database (Agent 2)
- `pytz` → `zoneinfo` 마이그레이션 (Python 표준 라이브러리 사용)
- DB 연결 안정성: `pool_pre_ping`, `PRAGMA foreign_keys`, `cache_size` 64MB
- `publisher` 인덱스 및 모델 `__repr__` 추가

### Logging & WebSocket (Agent 3)
- `broadcast_log()` 크롤러 실시간 연동 (진행률 WebSocket 전송)
- Request ID 미들웨어 (`X-Request-ID` 헤더)
- 로그 파일 로테이션 (5MB × 3 파일)

### API (Agent 4)
- `/api/chatbot` (3초) 및 `/api/daily-brief` (5초) rate limiting
- 입력 검증: `keyword` 100자 제한, 미래 날짜 거부
- N+1 쿼리 해결 (`joinedload`) 및 `datetime.utcnow()` → `datetime.now(timezone.utc)`

### Crawler (Agent 5)
- 크롤링 최대 시간 제한 (`CRAWL_MAX_DURATION_MINUTES`, 기본 30분)
- URL 해시 최적화 (메모리 ~80MB → ~4MB)
- Playwright 이미지/CSS/폰트 차단으로 속도 2-3x 향상

### LLM Service (Agent 6)
- `max_tokens` 비용 보호 (기사 1000, 리포트 4000)
- 응답 검증 강화 (sentiment clamp, category 검증, 빈 요약 폴백)
- httpx 타임아웃 세분화 (connect 10s, read 45s)

### Component Structure (Agent 7)
- `ErrorBoundary` 전역 에러 핸들링
- `React.lazy` + `Suspense` 코드 스플리팅
- `IntersectionObserver` 의존성 배열 수정 (성능)

### State Management (Agent 8)
- Axios 인터셉터 자동 재시도 (2회, exponential backoff)
- 스마트 폴링: 유휴 60초 / 크롤링 중 3초
- `AbortController` 날짜 변경 시 이전 요청 취소

### UI/UX (Agent 9)
- 다크모드 `localStorage` 영속화 + 시스템 테마 감지
- 스켈레톤 로딩 UI 컴포넌트
- **전역 CSS `*` transition 제거 (핵심 성능 수정)**
- Chatbot `aria-modal` 접근성 수정

### Charts & Utilities (Agent 10)
- 차트 모바일 반응형 (라벨 truncate, 키워드 10개 제한)
- HTML 리포트 다크모드/인쇄 최적화
- 날짜/숫자 포맷 유틸리티 (`formatters.ts`)

### Tests (Agent 11)
- 크롤러 단위 테스트 (`test_crawler.py`)
- LLM 서비스 테스트 (`test_llm_service.py`)
- React 컴포넌트 테스트 (`components.test.tsx`)

### Documentation (Agent 12)
- `CHANGELOG.md` 작성
- `docs/ENV_REFERENCE.md` 환경변수 레퍼런스
- `docs/TROUBLESHOOTING.md` 문제 해결 가이드

## [2.0.0] - Phase 2: 33-Point MECE Upgrade

- 12개 Agent의 MECE 기반 구조적 개선
- Pydantic V2 마이그레이션
- 인덱스 최적화 및 WAL 모드
- 크롤러 안정성 및 오류 처리
- LLM mock 폴백 시스템
- React 컴포넌트 분리 및 shadcn/ui 통합
- 대시보드 UX 개선 (토스트, 무한스크롤, 아코디언)

## [1.0.0] - Phase 1: Initial Setup & Fix

- FastAPI + SQLite 백엔드 구동
- React + Vite 프론트엔드 구동
- 포트 충돌 해결 (8000/5173)
- 의존성 및 빌드 오류 수정
- CORS 설정 통합
