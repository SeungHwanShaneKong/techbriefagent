# 프로젝트 요약 및 미완료 계획 정리

> 작성일: 2026-03-07

---

## 1. 프로젝트 개요

**프로젝트명:** 테.읽.남. (Tech News Intelligence Hub)
**설명:** AI 기반 글로벌 기술 뉴스 자동 수집/분석/리포팅 풀스택 플랫폼

24개 글로벌 기술 미디어 RSS 피드에서 뉴스를 병렬 크롤링하고, OpenAI GPT 모델로 요약/번역/감성분석/키워드 추출/카테고리 분류를 수행한 뒤, React 대시보드에서 실시간 시각화하는 시스템입니다.

---

## 2. 기술 스택

| 영역 | 기술 |
|---|---|
| **Backend** | Python 3.10+ / FastAPI 0.115 / SQLAlchemy 2.0 / SQLite (WAL) |
| **AI/LLM** | OpenAI API (gpt-4o-mini 기본) |
| **크롤링** | Playwright + BeautifulSoup4 + feedparser (8 병렬 스레드) |
| **Frontend** | React 18 + TypeScript 5.9 + Vite 7 |
| **스타일링** | Tailwind CSS 3.4 + Radix UI |
| **차트** | Recharts 3.7 |
| **배포** | Docker Compose (Backend:8000, Frontend:8501) |
| **DB 마이그레이션** | Alembic |

---

## 3. 완료된 단계 (Phase 1~3)

### Phase 1 - 초기 구축 및 오류 수정 ✅
- FastAPI + SQLite 백엔드 구동
- React + Vite 프론트엔드 구동
- 포트 충돌 해결, 의존성/빌드 오류 수정, CORS 설정 통합

### Phase 2 - 33-Point MECE Upgrade ✅
- 12개 Agent의 MECE 기반 구조적 개선
- Pydantic V2 마이그레이션
- 인덱스 최적화 및 WAL 모드
- 크롤러 안정성 및 오류 처리
- LLM mock 폴백 시스템
- React 컴포넌트 분리 및 shadcn/ui 통합
- 대시보드 UX 개선 (토스트, 무한스크롤, 아코디언)

### Phase 3 - 36-Point Upgrade ✅
- **인프라**: .gitignore/.dockerignore 보강, requirements-dev.txt 분리, startup_check.py
- **데이터베이스**: pytz→zoneinfo 마이그레이션, pool_pre_ping, cache 64MB
- **로깅/WebSocket**: broadcast_log() 크롤러 연동, Request ID 미들웨어, 로그 로테이션
- **API**: rate limiting, 입력 검증, N+1 쿼리 해결, datetime.utcnow() 제거
- **크롤러**: 최대 시간 제한, URL 해시 최적화 (80MB→4MB), Playwright 리소스 차단
- **LLM**: max_tokens 비용 보호, 응답 검증 강화, httpx 타임아웃 세분화
- **Frontend**: ErrorBoundary, React.lazy 코드 스플리팅, 다크모드 영속화, 스켈레톤 UI
- **차트**: 모바일 반응형, HTML 리포트 다크모드/인쇄 최적화
- **테스트**: 33 backend + 15 frontend 테스트 (총 48개, 모두 통과)
- **문서**: CHANGELOG, ENV_REFERENCE, TROUBLESHOOTING 작성

---

## 4. 현재 시스템 주요 기능

| 기능 | 상태 | 설명 |
|---|---|---|
| RSS 병렬 크롤링 | ✅ 완료 | 24개 피드, 8 스레드, Playwright JS 렌더링 |
| AI 기사 분석 | ✅ 완료 | 요약/번역/감성/키워드/카테고리 자동 분류 |
| 일일 전략 브리핑 | ✅ 완료 | LLM 기반 Strategic Intelligence Report 생성 |
| AI 챗봇 | ✅ 완료 | 수집 뉴스 기반 3줄 요약 응답 |
| 실시간 대시보드 | ✅ 완료 | 통계카드, 차트, 기사 목록, 리포트 탭 |
| 다크 모드 | ✅ 완료 | 시스템 감지 + 수동 전환 + localStorage 영속화 |
| WebSocket 로그 | ✅ 완료 | 크롤링 진행률 실시간 스트리밍 |
| 비용 추적 | ✅ 완료 | 토큰/비용 기록, USD→KRW 환산, 일별 추이 차트 |
| LLM Fallback | ✅ 완료 | API 키 미설정/실패 시 mock 응답 반환 |
| Docker 배포 | ✅ 완료 | docker-compose, health check, 볼륨 매핑 |

---

## 5. 미완료 / 향후 개선 과제

코드베이스 분석 결과, Phase 1~3까지 핵심 기능은 모두 구현 완료되었으나 다음 영역에서 추가 개선이 가능합니다:

### 5-1. 인증 및 보안 (미구현)
- [ ] 사용자 인증/인가 시스템 (JWT 또는 OAuth2)
- [ ] API 키 기반 접근 제어
- [ ] 관리자/일반 사용자 역할 분리

### 5-2. 데이터베이스 확장 (미구현)
- [ ] PostgreSQL 전환 (프로덕션 대규모 배포용)
- [ ] 데이터 보존 정책 (오래된 기사 아카이빙/삭제 스케줄링)
- [ ] 기사 북마크/즐겨찾기 기능

### 5-3. 스케줄링 자동화 (미구현)
- [ ] 크롤링 자동 스케줄러 (cron 또는 APScheduler 기반 정기 수집)
- [ ] 일일 브리핑 자동 생성 및 이메일/Slack 발송
- [ ] 크롤링 실패 시 알림 시스템

### 5-4. 검색 및 필터링 고도화 (부분 구현)
- [ ] 전문 검색 엔진 통합 (Elasticsearch 또는 SQLite FTS5)
- [ ] 기사 본문 내 키워드 검색
- [ ] 고급 필터 조합 (날짜 범위 + 카테고리 + 감성 범위 동시)

### 5-5. Frontend UX 고도화 (부분 구현)
- [ ] 사용자 설정 페이지 (RSS 소스 관리, 알림 설정)
- [ ] 기사 비교 뷰 (여러 기사 나란히 비교)
- [ ] PWA 지원 (오프라인 캐싱, 푸시 알림)
- [ ] i18n 다국어 지원 (현재 한국어 고정)

### 5-6. 모니터링 및 운영 (부분 구현)
- [ ] APM 통합 (Sentry, Datadog 등)
- [ ] 헬스체크 전용 엔드포인트 (`/health`, `/readiness`)
- [ ] 크롤링 성공률/실패율 통계 대시보드
- [ ] LLM 응답 품질 모니터링 (요약 길이, 감성 분포 이상 탐지)

### 5-7. 테스트 강화 (부분 구현)
- [ ] E2E 테스트 (Playwright 또는 Cypress)
- [ ] API 통합 테스트 (실제 DB 연동)
- [ ] 테스트 커버리지 80% 이상 달성
- [ ] CI/CD 파이프라인 구축 (GitHub Actions)

### 5-8. 한국 뉴스 소스 추가 (미구현)
- [ ] 한국 기술 미디어 RSS 추가 (ZDNet Korea, IT조선, 전자신문 등)
- [ ] 한국어 원문 처리 로직 (번역 불필요, 요약만 수행)
- [ ] 다국어 뉴스 혼합 대시보드

---

## 6. API 엔드포인트 현황

| Endpoint | Method | 설명 |
|---|---|---|
| `/api/stats` | GET | 대시보드 통계 |
| `/api/news` | GET | 기사 목록 (페이지네이션, 필터) |
| `/api/news-dates` | GET | 데이터 보유 일자 목록 |
| `/api/daily-brief` | GET | 일일 전략 브리핑 |
| `/api/crawl` | POST | 크롤링 실행 |
| `/api/crawl-status` | GET | 크롤링 진행 상태 |
| `/api/repair-analysis` | POST | 저품질 요약 재분석 |
| `/api/chatbot` | POST | AI 챗봇 질문 |
| `/ws/logs` | WebSocket | 실시간 로그 스트리밍 |

---

## 7. 프로젝트 통계

| 항목 | 수치 |
|---|---|
| 백엔드 Python 파일 | 15개 (~3,500+ 줄) |
| 프론트엔드 TSX/TS 파일 | 40개+ |
| 테스트 | 48개 (백엔드 33 + 프론트엔드 15) |
| 문서 파일 | 7개 (~2,000+ 줄) |
| RSS 피드 소스 | 24개 (4 Tier) |
| API 엔드포인트 | 8개 + 1 WebSocket |
| Git 커밋 | 1개 (Phase 1~3 통합) |
