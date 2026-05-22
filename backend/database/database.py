import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# PostgreSQL URL'si .env dosyasından okunacak.
# Geliştirme aşamasında lokal testler için varsayılan olarak SQLite kullanıyoruz.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./santiye.db")

# SQLite için aynı thread uyarısını kapatıyoruz, PostgreSQL'de buna gerek kalmayacak.
connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
