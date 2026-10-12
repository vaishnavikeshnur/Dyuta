from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

SECRET_KEY = os.getenv("SECRET_KEY", "guardianmap-development-secret-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'guardianmap.db'}")
