@echo off
chcp 65001 >nul 2>&1
setlocal
title Tech News Hub - Turn ON
cd /d "%~dp0"

echo ============================================
echo   Global Tech News Intelligence Hub
echo   서비스 시작 (Turn ON)
echo ============================================
echo.

:: ── 가상환경 확인 ──
if not exist ".\venv\Scripts\python.exe" (
    echo [ERROR] 가상환경을 찾을 수 없습니다: venv\Scripts\python.exe
    echo 먼저 아래 명령을 실행하세요:
    echo   cd tech_news_hub ^&^& python -m venv venv ^&^& .\venv\Scripts\pip install -r requirements.txt
    pause
    exit /b 1
)

:: ── 환경변수 설정 ──
set "PYTHONUNBUFFERED=1"
if "%OPENAI_API_KEY%"=="" for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('OPENAI_API_KEY','User')"`) do set "OPENAI_API_KEY=%%i"
if "%OPENAI_MODEL%"=="" set "OPENAI_MODEL=gpt-5-mini"
if "%OPENAI_INPUT_COST_PER_1M%"=="" set "OPENAI_INPUT_COST_PER_1M=0.25"
if "%OPENAI_OUTPUT_COST_PER_1M%"=="" set "OPENAI_OUTPUT_COST_PER_1M=2.00"
if "%USD_TO_KRW_RATE%"=="" set "USD_TO_KRW_RATE=1350"
if "%OPENAI_SSL_VERIFY%"=="" set "OPENAI_SSL_VERIFY=false"

if "%OPENAI_API_KEY%"=="" (
    echo [WARN] OPENAI_API_KEY 미설정 - 모의 요약 모드로 실행됩니다.
)

:: ── 기존 프로세스 정리 ──
echo [1/4] 기존 포트 점유 프로세스 정리 중...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%p >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :8501 ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%p >nul 2>&1
echo    완료.

:: ── 백엔드 시작 ──
echo [2/4] Backend API 시작 중 (http://localhost:8000) ...
start "tech-news-backend" /min cmd /c ".\venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000"

:: ── 백엔드 부팅 대기 ──
echo [3/4] 백엔드 초기화 대기 (4초)...
powershell -NoProfile -Command "Start-Sleep -Seconds 4" >nul

:: ── 프론트엔드 시작 ──
echo [4/4] Frontend Dashboard 시작 중 (http://localhost:8501) ...
start "tech-news-frontend" /min powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-Location '%CD%\frontend'; if (-not (Test-Path 'node_modules')) { npm install }; npm run dev:8501"

echo.
echo ============================================
echo   모든 서비스가 시작되었습니다!
echo   Dashboard : http://localhost:8501
echo   API Docs  : http://localhost:8000/docs
echo ============================================
echo.

:: 5초 후 자동으로 대시보드 열기
powershell -NoProfile -Command "Start-Sleep -Seconds 5" >nul
start "" "http://localhost:8501"
