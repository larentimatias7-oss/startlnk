from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "TSM Starlink Monitoring Dashboard"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api"

    # TSM ECHO Credentials
    ECHO_BASE_URL: str = "https://echo.tsmpatagonia.com.ar/api"
    ECHO_EMAIL: str = ""
    ECHO_PASSWORD: str = ""

    # Database & Worker
    DATABASE_URL: str = "sqlite:///./starlink_dashboard.db"
    SYNC_INTERVAL_MINUTES: int = 15
    ENABLE_SCHEDULER: bool = True

    # CORS
    CORS_ORIGINS: List[str] = ["*"]

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
