import os
import sys
from pathlib import Path
from urllib.parse import urlparse
from pydantic_settings import BaseSettings, SettingsConfigDict


def find_env_file() -> tuple[Path | None, list[Path]]:
    """
    Search candidate paths for a .env file in priority order.
    Returns (resolved_file_path, list_of_searched_paths).
    """
    current_dir = Path.cwd()
    backend_dir = Path(__file__).resolve().parent
    root_dir = backend_dir.parent

    candidates: list[Path] = []

    # 1. Current working directory .env
    candidates.append(current_dir / ".env")

    # 2. Project root .env (if different from CWD)
    if (root_dir / ".env") not in candidates:
        candidates.append(root_dir / ".env")

    # 3. Backend directory .env (if different)
    if (backend_dir / ".env") not in candidates:
        candidates.append(backend_dir / ".env")

    for candidate in candidates:
        if candidate.is_file():
            return candidate, candidates

    return None, candidates


resolved_env_file, searched_paths = find_env_file()

if os.getenv("DATABASE_URL"):
    env_source_description = "System Environment Variable (DATABASE_URL)"
elif resolved_env_file:
    env_source_description = str(resolved_env_file)
else:
    searched_str = "\n  - ".join(str(p) for p in searched_paths)
    sys.stderr.write(
        "\n" + "=" * 70 + "\n"
        "❌ CONFIGURATION ERROR: DATABASE_URL not found!\n"
        "CipherWatch requires a DATABASE_URL to connect to the database.\n"
        "Searched for .env file in the following locations:\n"
        f"  - {searched_str}\n\n"
        "Why loading failed: No .env file was found at any search location and DATABASE_URL environment variable is unset.\n"
        "How to fix:\n"
        "  1. Create a .env file in project root or backend/ directory.\n"
        "  2. Add: DATABASE_URL=postgresql://user:pass@host:port/dbname\n"
        + "=" * 70 + "\n\n"
    )
    sys.exit(1)


class Settings(BaseSettings):
    """Application settings and configuration."""

    PROJECT_NAME: str = "CipherWatch API"
    VERSION: str = "0.1.0"
    API_PREFIX: str = "/api"
    DEBUG: bool = True
    DATABASE_URL: str
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    RESEND_API_KEY: str = ""
    SENDER_EMAIL: str = "CipherWatch Security <onboarding@resend.dev>"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    JWT_SECRET_KEY: str = "cipherwatch_jwt_secret_key_change_in_production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24

    @property
    def normalized_database_url(self) -> str:
        """Ensure PostgreSQL connection URLs start with postgresql:// for SQLAlchemy compatibility."""
        url = self.DATABASE_URL
        if url and url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url

    model_config = SettingsConfigDict(
        env_file=str(resolved_env_file) if resolved_env_file else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )


try:
    settings = Settings()
except Exception as e:
    sys.stderr.write(
        "\n" + "=" * 70 + "\n"
        f"❌ SETTINGS VALIDATION FAILURE: {e}\n"
        "How to fix: Ensure DATABASE_URL is specified in your .env file.\n"
        + "=" * 70 + "\n\n"
    )
    sys.exit(1)


def print_db_startup_info() -> None:
    """Print sanitized database startup diagnostics without revealing credentials."""
    url = settings.normalized_database_url
    parsed = urlparse(url)
    dialect = parsed.scheme.split("+")[0] if parsed.scheme else "unknown"
    if dialect == "postgres":
        dialect = "postgresql"

    if dialect == "sqlite":
        host = parsed.path or "./cipherwatch.db"
    else:
        host = parsed.hostname or "localhost"

    print("=" * 70)
    print(f"Loaded DATABASE_URL from: {env_source_description}")
    print(f"Database Dialect:        {dialect}")
    print(f"Host:                    {host}")
    print("=" * 70)


# Print startup database diagnostics on initial module import (except during pytest runs)
if "pytest" not in sys.modules:
    print_db_startup_info()

