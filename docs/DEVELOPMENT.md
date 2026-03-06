# 개발 가이드 (Development Guide)

## 사전 요구사항 (Prerequisites)

### 필수 소프트웨어

| 소프트웨어 | 최소 버전 | 비고 |
|---|---|---|
| Python | 3.10+ | 3.13 권장 |
| Node.js | 18+ | 20 LTS 권장 |
| npm | 9+ | Node.js에 포함 |
| Git | 2.30+ | 버전 관리 |

### 선택 소프트웨어

| 소프트웨어 | 용도 |
|---|---|
| Docker / Docker Compose | 컨테이너 배포 |
| Chromium / Chrome | Playwright 크롤링 (자동 설치 가능) |

---

## 환경 변수 (Environment Variables)

프로젝트 루트의 `.env` 파일에 설정합니다. `env.example`을 복사하여 사용하세요.

```bash
cp env.example .env
```

### 환경 변수 목록

| 변수명 | 필수 | 기본값 | 설명 |
|---|---|---|---|
| `OPENAI_API_KEY` | O | - | OpenAI API 키. 미설정 시 mock 모드로 동작 |
| `OPENAI_MODEL` | X | `gpt-4o-mini` | 사용할 OpenAI 모델 (gpt-4o-mini, gpt-4o, gpt-4-turbo, gpt-3.5-turbo) |
| `OPENAI_INPUT_COST_PER_1M` | X | 모델별 자동 | 입력 토큰 100만개당 비용 (USD) |
| `OPENAI_OUTPUT_COST_PER_1M` | X | 모델별 자동 | 출력 토큰 100만개당 비용 (USD) |
| `OPENAI_SSL_VERIFY` | X | `false` | OpenAI API SSL 인증서 검증 여부 |
| `DB_URL` | X | `sqlite:///./tech_news.db` | SQLAlchemy 데이터베이스 URL |
| `CORS_ORIGINS` | X | `http://localhost:5173,...` | CORS 허용 origin (쉼표 구분) |
| `LOG_LEVEL` | X | `INFO` | 로그 레벨 (DEBUG, INFO, WARNING, ERROR) |
| `USD_TO_KRW_RATE` | X | `1350.0` | USD-KRW 환율 (비용 환산용) |

### 모델별 내장 가격표

`OPENAI_INPUT_COST_PER_1M` / `OPENAI_OUTPUT_COST_PER_1M`을 설정하지 않으면 내장 가격표를 사용합니다:

| 모델 | 입력 ($/1M tokens) | 출력 ($/1M tokens) |
|---|---|---|
| gpt-4o-mini | 0.15 | 0.60 |
| gpt-4o | 2.50 | 10.00 |
| gpt-4-turbo | 10.00 | 30.00 |
| gpt-3.5-turbo | 0.50 | 1.50 |

---

## 로컬 개발 환경 설정

### Backend 실행

```bash
# 1. 가상환경 생성 및 활성화
python -m venv venv
source venv/bin/activate        # Linux/Mac
.\venv\Scripts\activate         # Windows

# 2. 의존성 설치
pip install -r requirements.txt

# 3. Playwright 브라우저 설치 (크롤링용)
playwright install chromium

# 4. 환경 변수 설정
cp env.example .env
# .env 파일을 편집하여 OPENAI_API_KEY를 입력

# 5. 서버 실행 (개발 모드 - 자동 리로드)
uvicorn backend.main:app --reload --port 8000
```

서버가 시작되면 아래 URL에서 확인할 수 있습니다:
- API: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Frontend 실행

```bash
# 1. 디렉토리 이동
cd frontend

# 2. 의존성 설치
npm install

# 3. 개발 서버 실행
npm run dev
```

개발 서버는 `http://localhost:5173`에서 실행됩니다.

### Frontend 환경 변수

Frontend는 Vite 환경 변수를 통해 Backend URL을 설정합니다:

| 변수명 | 기본값 | 설명 |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend API 기본 URL |

`.env` 파일을 `frontend/` 디렉토리에 생성하거나, 실행 시 환경 변수로 지정합니다:

```bash
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

---

## 테스트 실행

### Backend 테스트 (pytest)

```bash
# 전체 테스트 실행
pytest

# 상세 출력
pytest -v

# 특정 테스트 파일
pytest backend/tests/test_api.py
pytest backend/tests/test_models.py

# 커버리지 포함 (pytest-cov 필요)
pytest --cov=backend --cov-report=html
```

pytest 설정은 `pytest.ini`에 정의되어 있습니다.

### Frontend 테스트

```bash
cd frontend

# 린트 검사
npm run lint

# TypeScript 타입 검사
npx tsc --noEmit

# 빌드 테스트
npm run build
```

---

## 코드 스타일 가이드라인

### Backend (Python)

- Python 3.10+ 타입 힌트 사용
- SQLAlchemy ORM 패턴 준수
- Pydantic v2 모델로 요청/응답 스키마 정의
- 로거는 `logging_config.py`에서 가져와 사용:
  ```python
  from .logging_config import crawler_logger as logger
  logger.info("메시지")
  ```
- 비동기 함수에는 `async/await` 사용 (FastAPI 엔드포인트)
- LLM 관련 함수는 반드시 fallback 로직 포함

### Frontend (TypeScript + React)

- TypeScript strict 모드 사용
- 인터페이스는 `types.ts`에 집중 관리
- API 호출 함수는 `api.ts`에 집중 관리
- 컴포넌트 구조:
  - `components/ui/` -- Radix UI 기반 공통 컴포넌트
  - `components/layout/` -- 레이아웃 컴포넌트 (Header, Sidebar)
  - `components/dashboard/` -- 대시보드 탭별 컴포넌트
  - `components/charts/` -- Recharts 차트 컴포넌트
  - `components/common/` -- 유틸리티 컴포넌트 (Toast 등)
- 상태 관리는 React `useState` + `useCallback` + `useMemo` 조합
- ESLint 규칙 준수 (`npm run lint`)

---

## Docker 개발 워크플로

### Docker Compose로 전체 실행

```bash
# 빌드 및 실행
docker-compose up --build

# 백그라운드 실행
docker-compose up --build -d

# 로그 확인
docker-compose logs -f

# 특정 서비스 로그
docker-compose logs -f backend
docker-compose logs -f frontend

# 종료
docker-compose down
```

### Docker 서비스 구성

| 서비스 | 포트 | 설명 |
|---|---|---|
| `backend` | 8000 | FastAPI 백엔드 |
| `frontend` | 8501 | Vite 프론트엔드 (빌드 결과 서빙) |

### Docker 볼륨 매핑

- `./tech_news.db:/app/tech_news.db` -- SQLite 데이터베이스 파일이 호스트와 공유됩니다
- `.env` 파일이 `env_file`로 Backend 컨테이너에 주입됩니다

### Health Check

Backend 컨테이너는 `/docs` 엔드포인트로 헬스 체크를 수행합니다:
- 간격: 30초
- 타임아웃: 10초
- 재시도: 3회
- 시작 대기: 15초

Frontend는 Backend의 헬스 체크가 통과한 후 시작됩니다 (`depends_on: condition: service_healthy`).

---

## Windows 실행 스크립트

프로젝트에는 Windows용 배치 스크립트가 포함되어 있습니다:

| 파일 | 설명 |
|---|---|
| `turn_on.bat` | Backend + Frontend 동시 실행 |
| `turn_off.bat` | 실행 중인 서버 프로세스 종료 |

---

## DB 마이그레이션 (Alembic)

```bash
# 새 마이그레이션 생성
alembic revision --autogenerate -m "설명"

# 마이그레이션 적용 (최신)
alembic upgrade head

# 마이그레이션 상태 확인
alembic current

# 1단계 롤백
alembic downgrade -1
```

Alembic 설정은 `alembic.ini`와 `alembic/` 디렉토리에 있습니다.

---

## 트러블슈팅 (Troubleshooting)

### 1. "OPENAI_API_KEY 미설정" 관련

**증상**: 모든 AI 분석이 mock(모의) 결과로 반환됨

**해결**:
```bash
# .env 파일 확인
cat .env | grep OPENAI_API_KEY
# "your_openai_api_key_here"가 아닌 실제 키가 설정되어 있는지 확인

# 서버 재시작
uvicorn backend.main:app --reload --port 8000
```

### 2. Playwright 브라우저 미설치

**증상**: 크롤링 시 "Browser not installed" 에러

**해결**:
```bash
playwright install chromium
```

### 3. SQLite "database is locked" 에러

**증상**: 동시 요청 시 DB 락 에러 발생

**해결**:
- WAL 모드가 활성화되어 있는지 확인 (기본 설정에 포함)
- `busy_timeout=5000` 설정 확인
- 여러 프로세스가 동시에 DB에 쓰기를 시도하지 않는지 확인

### 4. CORS 에러

**증상**: Frontend에서 API 호출 시 CORS 에러

**해결**:
```bash
# .env에서 CORS_ORIGINS 확인
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:8501

# Frontend가 다른 포트를 사용하는 경우 해당 origin 추가
```

### 5. Frontend 빌드 실패

**증상**: `npm run build` 시 TypeScript 에러

**해결**:
```bash
cd frontend
# TypeScript 버전 확인
npx tsc --version

# 의존성 재설치
rm -rf node_modules package-lock.json
npm install

# 타입 에러 확인
npx tsc --noEmit
```

### 6. Rate Limit (429) 에러

**증상**: 크롤링 요청 시 "너무 빠른 요청입니다" 에러

**해결**:
- 크롤링 요청은 30초 쿨다운이 적용됩니다
- 이전 요청 완료 후 30초 대기 후 재시도하세요
- 이미 실행 중인 크롤링은 `/api/crawl-status`로 상태를 확인하세요

### 7. 메모리 부족 (대규모 크롤링)

**증상**: 대규모 크롤링 (1000건 이상) 시 메모리 사용량 증가

**해결**:
- `min_articles` 값을 적절히 조절 (100~300 권장)
- 크롤링 완료 후 불필요한 프로세스를 종료
- Playwright 브라우저 인스턴스가 자동으로 정리되는지 확인

### 8. LLM 비용 관리

**팁**:
- `gpt-4o-mini`가 기본 모델이며 비용 대비 성능이 가장 효율적입니다
- `/api/stats`의 `usage` 섹션에서 누적 비용을 모니터링하세요
- 대시보드의 "운영 현황" 탭에서 일별 비용 추이를 확인하세요
- 일일 브리핑은 LRU 캐시 (7개)를 사용하므로 동일 날짜 재조회 시 추가 비용이 발생하지 않습니다
