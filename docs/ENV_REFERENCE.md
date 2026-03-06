# 환경변수 레퍼런스 (Environment Variable Reference)

Tech News Intelligence Hub에서 사용하는 모든 환경변수를 정리한 문서입니다.
`.env` 파일에 설정하거나 시스템 환경변수로 주입할 수 있습니다.

> 설정 파일 템플릿: 프로젝트 루트의 `env.example`을 `.env`로 복사하여 사용하세요.

---

## OpenAI / LLM 설정

| 변수명 | 기본값 | 필수 | 설명 |
|--------|--------|------|------|
| `OPENAI_API_KEY` | _(없음)_ | **Yes** | OpenAI API 키. 미설정 시 Mock(모의) 응답으로 자동 폴백되어 실제 LLM 호출 없이 동작합니다. |
| `OPENAI_MODEL` | `gpt-4o-mini` | No | 사용할 OpenAI 모델명. `gpt-4o`, `gpt-4-turbo`, `gpt-3.5-turbo` 등 지원. |
| `OPENAI_INPUT_COST_PER_1M` | `0.25` | No | 입력 토큰 100만개당 비용 (USD). 대시보드 비용 추적에 사용됩니다. |
| `OPENAI_OUTPUT_COST_PER_1M` | `2.0` | No | 출력 토큰 100만개당 비용 (USD). 대시보드 비용 추적에 사용됩니다. |
| `OPENAI_MAX_TOKENS_ARTICLE` | `1000` | No | 개별 기사 요약 시 최대 토큰 수. 비용 보호를 위한 상한값입니다. |
| `OPENAI_MAX_TOKENS_DIGEST` | `4000` | No | 일일 종합 리포트 생성 시 최대 토큰 수. 비용 보호를 위한 상한값입니다. |
| `OPENAI_SSL_VERIFY` | `false` | No | OpenAI API 호출 시 SSL 인증서 검증 여부. 회사 프록시 환경에서 `false`로 설정하세요. |

---

## 데이터베이스 설정

| 변수명 | 기본값 | 필수 | 설명 |
|--------|--------|------|------|
| `DB_URL` | `sqlite:///./tech_news.db` | No | SQLAlchemy 데이터베이스 URL. SQLite가 기본이며, PostgreSQL 전환 시 `postgresql://user:pass@host/db` 형식을 사용하세요. WAL 모드, `busy_timeout=5000`, `cache_size=64MB`가 자동 설정됩니다. |

---

## 서버 설정

| 변수명 | 기본값 | 필수 | 설명 |
|--------|--------|------|------|
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | No | CORS 허용 오리진 목록 (쉼표 구분). 프론트엔드 개발 서버 주소를 포함해야 합니다. |
| `LOG_LEVEL` | `INFO` | No | 로그 출력 레벨. `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` 중 선택. |
| `LOG_FILE` | `logs/technews.log` | No | 로그 파일 경로. 로테이션 정책: 5MB 초과 시 교체, 최대 3개 파일 보관. |

---

## 크롤러 설정

| 변수명 | 기본값 | 필수 | 설명 |
|--------|--------|------|------|
| `CRAWL_MAX_DURATION_MINUTES` | `30` | No | 크롤링 작업 최대 실행 시간 (분). 초과 시 자동 중단되어 무한 루프를 방지합니다. |

---

## 표시 / 환율 설정

| 변수명 | 기본값 | 필수 | 설명 |
|--------|--------|------|------|
| `USD_TO_KRW_RATE` | `1350.0` | No | USD→KRW 환율. 대시보드에서 API 비용을 원화로 환산하여 표시할 때 사용됩니다. |

---

## 프론트엔드 설정 (Vite)

| 변수명 | 기본값 | 필수 | 설명 |
|--------|--------|------|------|
| `VITE_API_BASE_URL` | `http://localhost:8000` | No | 백엔드 API 서버 URL. 프론트엔드 빌드 시 주입됩니다. Docker 환경에서는 `http://backend:8000`으로 설정하세요. `frontend/.env` 또는 `frontend/env.example`에서 관리합니다. |

---

## 설정 예시 (.env)

```bash
# 최소 필수 설정
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# 개발 환경 권장 설정
OPENAI_MODEL=gpt-4o-mini
DB_URL=sqlite:///./tech_news.db
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
LOG_LEVEL=INFO
CRAWL_MAX_DURATION_MINUTES=30
USD_TO_KRW_RATE=1350.0
```

## 참고 사항

- `OPENAI_API_KEY`가 설정되지 않으면 LLM 서비스는 **Mock 모드**로 동작합니다. Mock 모드에서는 실제 API 호출 없이 미리 정의된 템플릿 응답을 반환합니다.
- `env.example` 파일에는 모든 변수의 기본값과 한국어 설명이 포함되어 있습니다.
- `startup_check.py`가 서버 시작 시 주요 환경변수의 유효성을 검증합니다.
- 프론트엔드 환경변수(`VITE_*`)는 빌드 타임에 번들에 포함되므로, 변경 후 재빌드가 필요합니다.
