from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql://psydict:psydict_dev@localhost:5432/psydict_db"
    SECRET_KEY: str = "change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    ANTHROPIC_API_KEY: str = ""

    APPLE_TEAM_ID: str = ""
    APPLE_KEY_ID: str = ""
    APPLE_PRIVATE_KEY: str = ""

    APNS_KEY_ID: str = ""
    APNS_TEAM_ID: str = ""
    APNS_CERT_PATH: str = ""
    APNS_BUNDLE_ID: str = "com.psychologydictionary.app"
    APNS_USE_SANDBOX: bool = True

    REVENUECAT_API_KEY: str = ""

    SPACES_KEY: str = ""
    SPACES_SECRET: str = ""
    SPACES_BUCKET: str = "psydict-documents"
    SPACES_REGION: str = "nyc3"
    SPACES_ENDPOINT: str = "https://nyc3.digitaloceanspaces.com"

    ENVIRONMENT: str = "development"
    CORS_ORIGINS: str = "http://localhost:8081,http://localhost:19006"
    BASE_URL: str = "http://localhost:8000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
