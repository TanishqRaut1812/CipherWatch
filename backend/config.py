from pydantic_settings import BaseSettings, SettingsConfigDict
import secrets


class Settings(BaseSettings):
    """Application settings and configuration."""

    PROJECT_NAME: str = "CipherWatch API"
    VERSION: str = "0.1.0"
    API_PREFIX: str = "/api"
    DEBUG: bool = True
    DATABASE_URL: str = "sqlite:///./cipherwatch.db"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    JWT_SECRET_KEY: str = secrets.token_hex(32)  # Override in .env for production
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
