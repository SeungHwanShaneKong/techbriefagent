@echo off
chcp 65001 >nul 2>&1
setlocal
title Tech News Hub - Turn OFF
cd /d "%~dp0"

echo ============================================
echo   Global Tech News Intelligence Hub
echo   서비스 종료 (Turn OFF)
echo ============================================
echo.

:: ── 포트 8000 (Backend) 종료 ──
echo [1/3] Backend (포트 8000) 종료 중...
set "KILLED_BE=0"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%p >nul 2>&1
    set "KILLED_BE=1"
)
if "%KILLED_BE%"=="1" (echo    Backend 프로세스 종료 완료.) else (echo    실행 중인 Backend가 없습니다.)

:: ── 포트 8501 (Frontend) 종료 ──
echo [2/3] Frontend (포트 8501) 종료 중...
set "KILLED_FE=0"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :8501 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%p >nul 2>&1
    set "KILLED_FE=1"
)
if "%KILLED_FE%"=="1" (echo    Frontend 프로세스 종료 완료.) else (echo    실행 중인 Frontend가 없습니다.)

:: ── 창 이름으로 잔여 프로세스 종료 ──
echo [3/3] 관련 창 정리 중...
taskkill /FI "WINDOWTITLE eq tech-news-backend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq tech-news-frontend*" /F >nul 2>&1

echo.
echo ============================================
echo   모든 서비스가 종료되었습니다.
echo ============================================
echo.
timeout /t 3 >nul
