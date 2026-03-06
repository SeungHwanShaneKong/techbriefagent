"""Application startup checks - validates required configuration."""
import os
import sys
import logging

logger = logging.getLogger("technews.startup")

def check_environment():
    """Validate required environment variables and warn about optional ones."""
    warnings = []
    
    # Check OpenAI API key
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or api_key == "your_openai_api_key_here":
        warnings.append(
            "OPENAI_API_KEY가 설정되지 않았습니다. "
            "LLM 기반 요약/챗봇은 폴백 모드로 작동합니다."
        )
    
    # Check model name
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    logger.info("사용 모델: %s", model)
    
    # Check database URL
    db_url = os.getenv("DB_URL", "sqlite:///./tech_news.db")
    logger.info("데이터베이스: %s", db_url.split("///")[-1] if "sqlite" in db_url else db_url)
    
    # Check log level
    log_level = os.getenv("LOG_LEVEL", "INFO")
    if log_level.upper() not in ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"):
        warnings.append(f"LOG_LEVEL '{log_level}'이(가) 유효하지 않습니다. INFO를 사용합니다.")
    
    # Print warnings
    for warning in warnings:
        logger.warning("[WARN] %s", warning)

    if not warnings:
        logger.info("[OK] 환경 설정 검증 완료 - 모든 설정이 정상입니다.")
    
    return len(warnings) == 0
