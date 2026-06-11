"""
SQLite -> PostgreSQL gecis yardimcisi.

Production'a gecmeden once:
  1. Bu dosyayi calistir:   py -3 app/core/db_migrate.py --check
  2. Sorun yoksa DATABASE_URL'yi PostgreSQL'e cevir:
       DATABASE_URL=postgresql+asyncpg://user:pass@localhost/santiye
  3. Alembic migration'lari PG uzerinde calistir:
       py -3 -m alembic upgrade head
  4. (Opsiyonel) Mevcut verileri tasimak icin:
       py -3 app/core/db_migrate.py --migrate

Adim adim PostgreSQL gecisi:
  a) PostgreSQL sunucusu kur (Docker onerilir):
       docker run -d --name santiye-pg -e POSTGRES_PASSWORD=secret -p 5432:5432 postgres:16
  b) Veritabani olustur:
       docker exec -it santiye-pg psql -U postgres -c "CREATE DATABASE santiye;"
  c) asyncpg surucusunu yukle:
       pip install asyncpg
  d) .env dosyasini guncelle:
       DATABASE_URL=postgresql+asyncpg://postgres:secret@localhost/santiye
  e) Bu scripti --check ile calistir, hata yoksa devam et
  f) Alembic ile sema olustur:
       py -3 -m alembic upgrade head
  g) Varsa verileri tasimak icin --migrate kullan
"""

import argparse
import os
import sys


# ---------------------------------------------------------------------------
# SQLite uyumluluk kontrolleri
# ---------------------------------------------------------------------------


def check_sqlite_compat() -> bool:
    """SQLite'a ozgu yapilari tespit et.

    Returns:
        True: Gorunen uyumsuzluk yok.
        False: Duzeltilmesi gereken sorunlar bulundu.
    """
    sorunlar: list[str] = []
    bilgiler: list[str] = []

    # bildirim_zamanlayici.py — SQLite-specific cast kontrolu
    zam_path = "app/services/bildirim_zamanlayici.py"
    if os.path.exists(zam_path):
        with open(zam_path, encoding="utf-8") as f:
            icerik = f.read()
        if "SqliteDate" in icerik or "cast(" in icerik.lower():
            sorunlar.append(
                f"UYARI: {zam_path} — SQLite-specific cast kullanıyor. "
                "PostgreSQL'e geçmeden önce ilgili satırı düzenleyin."
            )
    else:
        bilgiler.append(f"ATLANDI: {zam_path} bulunamadı")

    # proje.py — Enum tanimlari
    enum_path = "app/models/proje.py"
    if os.path.exists(enum_path):
        with open(enum_path, encoding="utf-8") as f:
            icerik = f.read()
        if "SAEnum" in icerik or "Enum" in icerik:
            bilgiler.append(
                f"BİLGİ: {enum_path} — Python/SA Enum kullanıyor. "
                "PostgreSQL'de CREATE TYPE ile native enum oluşturulabilir; "
                "Alembic bunu otomatik yönetir."
            )
    else:
        bilgiler.append(f"ATLANDI: {enum_path} bulunamadı")

    # database.py — asyncpg URL kontrolu
    db_path = "app/core/database.py"
    if os.path.exists(db_path):
        with open(db_path, encoding="utf-8") as f:
            icerik = f.read()
        if "check_same_thread" in icerik:
            bilgiler.append(
                f"BİLGİ: {db_path} — SQLite connect_args mevcut. "
                "PostgreSQL'e geçince bu satır otomatik devre dışı kalır (sqlite kontrolü var)."
            )

    # Sonuclari yazdir
    if bilgiler:
        print("Bilgi notları:")
        for b in bilgiler:
            print(f"  ℹ  {b}")

    if sorunlar:
        print("\nDüzeltilmesi gereken sorunlar:")
        for s in sorunlar:
            print(f"  ✗  {s}")
        print()
        return False

    print("\n✓ Görünür SQLite uyumsuzluğu tespit edilmedi.")
    _print_pg_instructions()
    return True


def _print_pg_instructions() -> None:
    print("\n--- PostgreSQL Geçiş Adımları ---")
    print("1. .env dosyasını güncelle:")
    print("     DATABASE_URL=postgresql+asyncpg://user:pass@localhost/santiye")
    print("2. asyncpg sürücüsünü kur:")
    print("     pip install asyncpg")
    print("3. Alembic migration'ı çalıştır:")
    print("     py -3 -m alembic upgrade head")
    print("4. Varsa SQLite verilerini taşımak için:")
    print("     py -3 app/core/db_migrate.py --migrate")
    print("---------------------------------")


# ---------------------------------------------------------------------------
# Veri tasima (baslangic iskelet — production'da test edilmeli)
# ---------------------------------------------------------------------------


def migrate_data() -> None:
    """SQLite'tan PostgreSQL'e veri kopyalama taslagi.

    NOT: Bu fonksiyon production ortaminda ayri bir proses olarak
    calistirilmali; uygulama ayakta iken kullanilmamalidir.
    """
    try:
        import sqlite3  # noqa: PLC0415
    except ImportError:
        print("HATA: sqlite3 modulu bulunamadı.")
        sys.exit(1)

    sqlite_url = os.environ.get("SQLITE_URL", "santiye.db")
    pg_url = os.environ.get("DATABASE_URL", "")

    if "postgresql" not in pg_url:
        print(
            "HATA: DATABASE_URL'de postgresql bulunamadı. "
            ".env dosyasını kontrol edin."
        )
        sys.exit(1)

    print(f"Kaynak: {sqlite_url}")
    print(f"Hedef : {pg_url}")
    print()
    print(
        "UYARI: Otomatik veri taşıma karmaşık olabilir. "
        "Büyük tablolar için pgloader veya benzeri araç kullanın:\n"
        "  https://pgloader.io/"
    )
    print()
    print("Mevcut tablolar (SQLite):")
    try:
        conn = sqlite3.connect(sqlite_url)
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        for row in cursor.fetchall():
            cursor2 = conn.execute(f"SELECT COUNT(*) FROM {row[0]}")  # noqa: S608
            count = cursor2.fetchone()[0]
            print(f"  {row[0]}: {count} satır")
        conn.close()
    except sqlite3.OperationalError as exc:
        print(f"SQLite okuma hatası: {exc}")
        sys.exit(1)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="SQLite → PostgreSQL geçiş yardımcısı"
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="SQLite'a özgü yapıları kontrol et",
    )
    parser.add_argument(
        "--migrate",
        action="store_true",
        help="Mevcut SQLite verilerini listele / taşıma rehberi göster",
    )
    args = parser.parse_args()

    if args.check:
        ok = check_sqlite_compat()
        sys.exit(0 if ok else 1)
    elif args.migrate:
        migrate_data()
    else:
        # Varsayilan: kontrol + talimatlar
        check_sqlite_compat()
