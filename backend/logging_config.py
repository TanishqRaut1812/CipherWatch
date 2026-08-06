import sys
import os
import logging
from loguru import logger

class InterceptHandler(logging.Handler):
    """Custom logging handler to intercept standard python logging events and route them to Loguru."""

    def emit(self, record: logging.LogRecord) -> None:
        # Get corresponding Loguru level if it exists
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        # Find caller from where originated the logged message
        frame = logging.currentframe()
        depth = 2
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


def setup_logging() -> logger:
    """Configures central structured logging using Loguru, intercepting all standard logger events."""
    logger.remove()

    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    is_json = os.getenv("LOG_FORMAT", "text").lower() == "json"

    # Configure Loguru output formats
    if is_json:
        logger.add(
            sys.stdout,
            level=log_level,
            serialize=True,
        )
    else:
        logger.add(
            sys.stdout,
            level=log_level,
            format="<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
            colorize=True,
        )

    # Intercept standard library logging calls and direct them through our custom handler
    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)

    # Configure library loggers: disable standard outputs and force propagation to the root logger
    for logger_name in ("uvicorn", "uvicorn.access", "uvicorn.error", "sqlalchemy", "gunicorn"):
        mod_logger = logging.getLogger(logger_name)
        mod_logger.handlers = []
        mod_logger.propagate = True

    # Suppress verbose SQLAlchemy engine SQL query echo log spam from polluting the CLI
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    return logger

setup_logging()
