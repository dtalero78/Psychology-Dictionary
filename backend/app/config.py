from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql://psydict:psydict_dev@localhost:5432/psydict_db"
    # Default left intentionally weak so local dev with no .env still boots.
    # Production *must* override via env var; `_validate_secret_key()` raises
    # at startup if the default leaks into a deployed environment.
    SECRET_KEY: str = "change-me-local-only-NEVER-USE-IN-PRODUCTION"
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
    # Shared secret you put in RC dashboard → Webhooks → Authorization header.
    # When unset, /subscriptions/webhook refuses every request.
    REVENUECAT_WEBHOOK_SECRET: str = ""

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


_WEAK_SECRETS = {
    "change-me",
    "change-me-local-only-NEVER-USE-IN-PRODUCTION",
    "secret",
    "supersecret",
    "",
}


def _validate(s: Settings) -> Settings:
    """Hard-fail when prod boots with a weak or default SECRET_KEY.

    Tokens are HS256-signed with SECRET_KEY; a leaked/known value lets anyone
    forge JWTs for any user. We refuse to start rather than serve forgeable
    auth.
    """
    if s.is_production:
        if s.SECRET_KEY in _WEAK_SECRETS or len(s.SECRET_KEY) < 32:
            raise RuntimeError(
                "SECRET_KEY is missing, default, or too short for production. "
                "Set ENVIRONMENT=development for local work, or provide a "
                ">=32-char random SECRET_KEY env var in production."
            )
        if not s.ANTHROPIC_API_KEY:
            raise RuntimeError("ANTHROPIC_API_KEY is required in production.")
    return s


@lru_cache
def get_settings() -> Settings:
    return _validate(Settings())
