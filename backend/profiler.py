import contextvars
import time
from typing import Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import event
from sqlalchemy.engine import Engine

from backend.logging_config import logger


class RequestProfiler:
    """Per-request metric collector for performance profiling."""

    def __init__(self, endpoint: str):
        self.endpoint: str = endpoint
        self.start_time: float = time.perf_counter()
        self.total_time_ms: float = 0.0
        self.db_query_time_ms: float = 0.0
        self.sql_query_count: int = 0
        self.rows_inserted: int = 0
        self.rows_selected: int = 0
        self.serialization_time_ms: float = 0.0


# Context variable to hold profiler instance for the active request execution context
profiler_var: contextvars.ContextVar[Optional[RequestProfiler]] = contextvars.ContextVar(
    "profiler_var", default=None
)


def setup_sqlalchemy_profiling(engine: Engine):
    """Attach SQLAlchemy event listeners to measure query timings and row counts."""

    @event.listens_for(engine, "before_cursor_execute")
    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        conn.info.setdefault("query_start_time", []).append(time.perf_counter())

    @event.listens_for(engine, "after_cursor_execute")
    def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        start_times = conn.info.get("query_start_time", [])
        if start_times:
            elapsed_ms = (time.perf_counter() - start_times.pop()) * 1000.0
        else:
            elapsed_ms = 0.0

        profiler = profiler_var.get()
        if profiler:
            profiler.sql_query_count += 1
            profiler.db_query_time_ms += elapsed_ms

            stmt_upper = statement.strip().upper() if statement else ""
            if stmt_upper.startswith("INSERT"):
                if executemany and isinstance(parameters, (list, tuple)):
                    profiler.rows_inserted += len(parameters)
                else:
                    profiler.rows_inserted += max(cursor.rowcount if hasattr(cursor, "rowcount") and cursor.rowcount > 0 else 1, 1)
            elif stmt_upper.startswith("SELECT"):
                if hasattr(cursor, "rowcount") and cursor.rowcount > 0:
                    profiler.rows_selected += cursor.rowcount
                elif hasattr(cursor, "fetchall"):
                    # Rowcount might be -1 for SELECT in some DBAPIs; fallback to 1 or cursor count
                    profiler.rows_selected += 1


class PerformanceProfilingMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware instrumenting every endpoint with performance profiling metrics."""

    async def dispatch(self, request: Request, call_next) -> Response:
        endpoint_path = f"{request.method} {request.url.path}"
        profiler = RequestProfiler(endpoint=endpoint_path)
        token = profiler_var.set(profiler)

        start_time = time.perf_counter()
        response = await call_next(request)
        render_start = time.perf_counter()
        
        # Calculate timing metrics
        end_time = time.perf_counter()
        profiler.total_time_ms = round((end_time - start_time) * 1000.0, 2)
        profiler.serialization_time_ms = round((end_time - render_start) * 1000.0, 2)
        profiler.db_query_time_ms = round(profiler.db_query_time_ms, 2)

        # Log detailed request profile
        log_msg = (
            f"[PERF PROFILE] {profiler.endpoint} | "
            f"Total: {profiler.total_time_ms}ms | "
            f"DB: {profiler.db_query_time_ms}ms | "
            f"Queries: {profiler.sql_query_count} | "
            f"Rows Inserted: {profiler.rows_inserted} | "
            f"Rows Selected: {profiler.rows_selected} | "
            f"Serialization: {profiler.serialization_time_ms}ms"
        )
        logger.info(log_msg)

        # Flag and log endpoints exceeding 100ms SLA threshold
        if profiler.total_time_ms > 100.0:
            suspected_bottleneck = "DB Network Latency / Unindexed Query" if profiler.db_query_time_ms > 50.0 else (
                "High SQL Query Count (N+1)" if profiler.sql_query_count > 10 else (
                    "Response Serialization Overhead" if profiler.serialization_time_ms > 40.0 else "Application CPU Processing"
                )
            )

            slow_log = (
                f"⚠️ [SLOW ENDPOINT DETECTED > 100ms]\n"
                f"  - Endpoint: {profiler.endpoint}\n"
                f"  - Execution Time: {profiler.total_time_ms} ms\n"
                f"  - SQL Query Count: {profiler.sql_query_count} (DB Time: {profiler.db_query_time_ms} ms)\n"
                f"  - Suspected Bottleneck: {suspected_bottleneck}"
            )
            logger.warning(slow_log)

        profiler_var.reset(token)
        return response
