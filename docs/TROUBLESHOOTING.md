# 문제 해결 가이드 (Troubleshooting Guide)

Tech News Intelligence Hub 운영 중 자주 발생하는 문제와 해결 방법을 정리한 문서입니다.

---

## 1. 포트 8000이 이미 사용 중 (Port 8000 already in use)

**증상:** 백엔드 서버 실행 시 `Address already in use` 또는 `[Errno 10048]` 에러 발생.

**원인:** 이전에 실행한 uvicorn 프로세스가 종료되지 않았거나, 다른 프로그램이 포트 8000을 점유 중입니다.

**해결 방법 (Windows):**

```powershell
# 1. 포트 8000을 사용 중인 프로세스 확인
netstat -ano | findstr :8000

# 2. 출력 예시에서 PID(마지막 숫자) 확인
#   TCP    0.0.0.0:8000    0.0.0.0:0    LISTENING    12345

# 3. 해당 PID의 프로세스 강제 종료
taskkill /PID 12345 /F

# 4. 서버 재시작
uvicorn backend.main:app --reload --port 8000
```

**해결 방법 (macOS/Linux):**

```bash
# 포트 확인 및 종료
lsof -i :8000
kill -9 <PID>
```

---

## 2. Playwright 미설치 (Playwright not installed)

**증상:** 크롤링 실행 시 `BrowserType.launch` 에러 또는 `Executable doesn't exist` 메시지 발생.

**원인:** Playwright Python 패키지는 설치되었지만, 브라우저 바이너리가 다운로드되지 않았습니다.

**해결 방법:**

```bash
# Chromium 브라우저만 설치 (권장, 가장 가벼움)
playwright install chromium

# 또는 모든 브라우저 설치
playwright install
```

**참고:** Docker 환경에서는 `Dockerfile`에 `RUN playwright install chromium --with-deps`를 포함해야 합니다. `--with-deps` 플래그가 시스템 의존성 라이브러리도 함께 설치합니다.

---

## 3. OpenAI API 키 미설정 (API Key not set)

**증상:** 기사 요약이 `[Mock]` 또는 `[AI 분석 불가]`로 표시되며, 대시보드에 `generated_with_model: false`가 반환됩니다.

**원인:** `.env` 파일에 `OPENAI_API_KEY`가 설정되지 않았거나 유효하지 않은 키가 입력되었습니다.

**Mock 폴백 동작 설명:**
- API 키가 없으면 LLM 서비스는 자동으로 **Mock 모드**로 전환됩니다.
- Mock 모드에서는 기사 제목 기반의 템플릿 요약을 생성합니다.
- 감성 점수는 기본값(50), 카테고리는 `General Tech`으로 설정됩니다.
- 시스템은 정상 동작하지만, 분석 품질이 제한됩니다.

**해결 방법:**

```bash
# 1. .env 파일에 API 키 설정
echo "OPENAI_API_KEY=sk-your-actual-api-key" >> .env

# 2. 서버 재시작 (dotenv가 자동 로드)
# 3. 이미 Mock으로 분석된 기사는 "분석 보정" 버튼으로 재분석 가능
```

**검증:** `startup_check.py`가 서버 시작 시 API 키 유효성을 확인하고 경고를 출력합니다.

---

## 4. CORS 에러 (Cross-Origin Request Blocked)

**증상:** 브라우저 콘솔에 `Access-Control-Allow-Origin` 관련 에러가 표시되고, API 요청이 실패합니다.

**원인:** 프론트엔드 개발 서버의 주소가 백엔드의 CORS 허용 목록에 포함되지 않았습니다.

**해결 방법:**

```bash
# .env 파일에서 CORS_ORIGINS에 프론트엔드 주소 추가 (쉼표로 구분)
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000
```

**주의 사항:**
- 프론트엔드 포트가 변경된 경우 (예: 5173 → 3000) 반드시 업데이트하세요.
- 여러 오리진은 쉼표로 구분하며, 공백은 자동으로 제거됩니다.
- 프로덕션 배포 시에는 실제 도메인만 허용하세요 (`*` 사용 금지).
- 서버 재시작 후 적용됩니다.

---

## 5. 일일 리포트가 비어 있음 (Empty daily report)

**증상:** `/api/daily-brief` 응답에 `total_articles: 0`이 반환되고, 요약 내용이 "해당 날짜에는 분석 가능한 기사 데이터가 없습니다"로 표시됩니다.

**원인:** 선택한 날짜에 크롤링된 기사가 없거나, 크롤링이 아직 실행되지 않았습니다.

**해결 방법:**

```
1. 대시보드에서 "수집" 버튼을 클릭하여 크롤링 실행
2. 크롤링 완료 후 (진행률 100%) 날짜를 다시 선택
3. 좌측 날짜 목록에서 기사가 있는 날짜 확인 (/api/news-dates)
```

**확인 사항:**
- 크롤링 상태는 `/api/crawl-status` 엔드포인트에서 실시간 확인 가능합니다.
- 기본적으로 최근 48시간 이내의 기사만 대시보드에 표시됩니다.
- 이전 날짜의 기사를 보려면 `target_date` 파라미터를 사용하세요.
- 미래 날짜는 조회할 수 없습니다 (400 에러 반환).

---

## 6. 데이터베이스 잠금 (Database locked)

**증상:** `sqlite3.OperationalError: database is locked` 에러가 간헐적으로 발생합니다.

**원인:** SQLite는 동시 쓰기를 제한하므로, 여러 프로세스가 동시에 DB에 접근하면 잠금 충돌이 발생할 수 있습니다.

**현재 적용된 완화 조치:**
- **WAL (Write-Ahead Logging) 모드:** 읽기와 쓰기의 동시 실행을 허용합니다.
- **busy_timeout=5000:** 잠금 발생 시 최대 5초 대기 후 재시도합니다.
- **pool_pre_ping:** 연결 풀에서 끊어진 연결을 자동 감지하고 재연결합니다.

```python
# database.py에 자동 설정되는 PRAGMA들:
PRAGMA journal_mode=WAL       # 동시 읽기/쓰기 허용
PRAGMA synchronous=NORMAL     # 성능과 안전성의 균형
PRAGMA busy_timeout=5000      # 5초 대기
PRAGMA foreign_keys=ON        # 참조 무결성 보장
PRAGMA cache_size=-64000      # 64MB 캐시
```

**추가 해결 방법:**
- 여러 uvicorn 워커를 실행하지 마세요 (`--workers 1` 유지).
- DB 파일에 대한 파일 잠금이 있는지 확인하세요 (`.db-wal`, `.db-shm` 파일 존재 여부).
- 지속적인 문제 발생 시 PostgreSQL 전환을 고려하세요 (`DB_URL` 변경).

---

## 7. 프론트엔드 빌드 에러 (Frontend build errors)

**증상:** `npm run build` 또는 `npm run dev` 실행 시 TypeScript 컴파일 에러 또는 모듈 미발견 에러가 발생합니다.

**해결 방법:**

```bash
# 1. node_modules 재설치
cd frontend
rm -rf node_modules package-lock.json
npm install

# 2. TypeScript 버전 확인 (5.x 권장)
npx tsc --version

# 3. Vite 캐시 초기화
rm -rf node_modules/.vite
npm run dev

# 4. 환경변수 확인
# frontend/.env 또는 frontend/env.example 참조
echo "VITE_API_BASE_URL=http://localhost:8000" > frontend/.env
```

**자주 발생하는 빌드 에러:**

| 에러 메시지 | 원인 | 해결 |
|-------------|------|------|
| `Module not found` | 의존성 미설치 | `npm install` 실행 |
| `Type error: Cannot find module` | TypeScript 타입 불일치 | `npm install` 후 IDE 재시작 |
| `VITE_API_BASE_URL is undefined` | 환경변수 미설정 | `frontend/.env` 파일 생성 |
| `ENOSPC: System limit for number of file watchers reached` | Linux 파일 감시 제한 | `echo fs.inotify.max_user_watches=524288 \| sudo tee -a /etc/sysctl.conf` |

---

## 추가 도움말

- 서버 로그 확인: `logs/technews.log` (로테이션: 5MB x 3 파일)
- WebSocket 실시간 로그: `ws://localhost:8000/ws/logs` 접속
- API 문서: `http://localhost:8000/docs` (Swagger UI)
- 환경변수 전체 목록: `docs/ENV_REFERENCE.md` 참조
