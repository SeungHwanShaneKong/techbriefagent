import logging
from logging.handlers import RotatingFileHandler
import os
import sys
from typing import Optional


def setup_logging(level: Optional[str] = None) -> logging.Logger:
    """Configure structured logging for the application.

    Args:
        level: Log level string (DEBUG, INFO, WARNING, ERROR).
               Defaults to LOG_LEVEL env var or INFO.

    Returns:
        Root application logger.
    """
    log_level = level or os.getenv("LOG_LEVEL", "INFO").upper()
    numeric_level = getattr(logging, log_level, logging.INFO)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-7s | %(name)-20s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(numeric_level)
    console_handler.setFormatter(formatter)

    # File handler with rotation
    log_file = os.getenv("LOG_FILE", "logs/technews.log")
    log_dir = os.path.dirname(log_file)
    if log_dir:
        os.makedirs(log_dir, exist_ok=True)

    file_handler = RotatingFileHandler(
        log_file, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    file_handler.setLevel(numeric_level)
    file_handler.setFormatter(formatter)

    # Root app logger
    app_logger = logging.getLogger("technews")
    app_logger.setLevel(numeric_level)
    # Avoid duplicate handlers on reload
    if not app_logger.handlers:
        app_logger.addHandler(console_handler)
        app_logger.addHandler(file_handler)

    # Quiet noisy third-party loggers
    for noisy in ("httpx", "httpcore", "urllib3", "asyncio"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    return app_logger


# Module-level loggers for each component
logger = setup_logging()
crawler_logger = logging.getLogger("technews.crawler")
llm_logger = logging.getLogger("technews.llm")
api_logger = logging.getLogger("technews.api")
ws_logger = logging.getLogger("technews.websocket")
