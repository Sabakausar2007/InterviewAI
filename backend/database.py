"""
database.py
Sets up the SQLAlchemy engine, session and declarative base used across the app.

Two modes, chosen automatically with zero extra configuration:

1. LOCAL / WINDOWS (your own PC with MySQL installed):
   If DATABASE_HOST is set in .env (this is the default in .env.example),
   the app connects to MySQL exactly as before. Nothing changes here.

2. FREE ONLINE HOSTING (e.g. Render's free tier, which has no MySQL):
   If DATABASE_HOST is NOT set at all (left out of the platform's
   environment variables), the app automatically uses a local SQLite file
   instead. SQLite needs no separate database server, so the app can start
   immediately on any free host with zero database setup.

You can also set DATABASE_URL directly to point at any SQLAlchemy-supported
database (e.g. a free MySQL/Postgres add-on) - if present, it overrides both
of the above.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

DIRECT_DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
DB_HOST = os.getenv("DATABASE_HOST", "").strip()

USING_SQLITE = False

if DIRECT_DATABASE_URL:
    DATABASE_URL = DIRECT_DATABASE_URL
    USING_SQLITE = DATABASE_URL.startswith("sqlite")
elif DB_HOST:
    DB_PORT = os.getenv("DATABASE_PORT", "3306")
    DB_USER = os.getenv("DATABASE_USER", "root")
    DB_PASSWORD = os.getenv("DATABASE_PASSWORD", "")
    DB_NAME = os.getenv("DATABASE_NAME", "interview_ai")
    DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
else:
    # No MySQL configured anywhere -> fall back to a local SQLite file so the
    # app still runs (used automatically on free hosting platforms).
    DB_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "interview_ai.db")
    DATABASE_URL = f"sqlite:///{DB_FILE}"
    USING_SQLITE = True

# SQLite needs this flag because FastAPI can use the same connection from
# different threads; pool_pre_ping/pool_recycle only make sense for MySQL.
if USING_SQLITE:
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=280)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_connection():
    """Used at startup to verify the database is reachable. Returns (ok: bool, message: str)."""
    try:
        with engine.connect() as conn:
            pass
        kind = "SQLite (local file)" if USING_SQLITE else "MySQL"
        return True, f"Database connection OK ({kind})"
    except Exception as e:
        return False, str(e)
