"""Application configuration via Pydantic Settings.

Reads environment variables from .env file automatically.
All sensitive values must be set in the .env file before running.
"""

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_SECRET = "change-in-production-secret-key-minimum-32-chars"


class Settings(BaseSettings):
    """Central settings object loaded from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Database ---
    DATABASE_URL: str = "sqlite+aiosqlite:///./santiye.db"

    # --- Security ---
    SECRET_KEY: str = _DEFAULT_SECRET
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 saat

    # --- LLM (Groq) ---
    GROQ_API_KEY: str = ""
    DEFAULT_MODEL: str = "llama-3.3-70b-versatile"

    # --- LLM (Gemini — ileride fotoğraf analizi için) ---
    GEMINI_API_KEY: str = ""

    # --- Twilio ---
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_WHATSAPP_FROM: str = "+14155238886"  # Sandbox numarası

    # --- App behaviour ---
    DEBUG: bool = False

    # --- File storage ---
    UPLOAD_DIR: str = "./uploads"
    OUTPUT_DIR: str = "./outputs"

    # --- CORS ---
    # Virgülle ayrılmış origin listesi. "*" tüm originlere izin verir.
    CORS_ORIGINS: str = "*"

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        if self.DEBUG:
            return self
        if self.SECRET_KEY == _DEFAULT_SECRET:
            raise ValueError(
                "Üretimde SECRET_KEY varsayılan değer kullanılamaz. "
                ".env dosyasına güçlü bir anahtar ekleyin."
            )
        if not self.GROQ_API_KEY:
            raise ValueError("Üretimde GROQ_API_KEY boş olamaz.")
        return self


settings = Settings()
