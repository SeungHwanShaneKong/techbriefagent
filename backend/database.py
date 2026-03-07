import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Use SQLite for simplicity as requested
SQLALCHEMY_DATABASE_URL = os.getenv("DB_URL", "sqlite:///./tech_news.db")

_is_sqlite = SQLALCHEMY_DATABASE_URL.startswith("sqlite")

# check_same_thread is needed for SQLite
_connect_args = {"check_same_thread": False} if _is_sqlite else {}
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args=_connect_args,
    pool_pre_ping=True,
)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if not _is_sqlite:
        return
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA cache_size=-64000")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
