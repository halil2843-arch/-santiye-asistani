"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-05-06
"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "musteriler",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("firma_adi", sa.String(200), nullable=False),
        sa.Column("email", sa.String(150), nullable=False, unique=True),
        sa.Column("telefon", sa.String(20)),
        sa.Column("plan", sa.Enum("free", "pro", "enterprise", name="plan_enum"), default="free"),
        sa.Column("aktif", sa.Boolean, default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index("ix_musteriler_email", "musteriler", ["email"])

    op.create_table(
        "kullanicilar",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("musteri_id", sa.String(36), sa.ForeignKey("musteriler.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ad_soyad", sa.String(150), nullable=False),
        sa.Column("email", sa.String(150), nullable=False, unique=True),
        sa.Column("telefon_no", sa.String(20)),
        sa.Column("rol", sa.Enum("admin", "editor", "viewer", name="rol_enum"), default="viewer"),
        sa.Column("sifre_hash", sa.String(255), nullable=False),
        sa.Column("aktif", sa.Boolean, default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index("ix_kullanicilar_musteri_id", "kullanicilar", ["musteri_id"])
    op.create_index("ix_kullanicilar_email", "kullanicilar", ["email"])

    op.create_table(
        "santiyeler",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("musteri_id", sa.String(36), sa.ForeignKey("musteriler.id", ondelete="CASCADE"), nullable=False),
        sa.Column("isim", sa.String(200), nullable=False),
        sa.Column("adres", sa.String(500)),
        sa.Column("aktif", sa.Boolean, default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index("ix_santiyeler_musteri_id", "santiyeler", ["musteri_id"])

    op.create_table(
        "sablonlar",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("musteri_id", sa.String(36), sa.ForeignKey("musteriler.id", ondelete="CASCADE"), nullable=False),
        sa.Column("santiye_id", sa.String(36), sa.ForeignKey("santiyeler.id", ondelete="SET NULL"), nullable=True),
        sa.Column("isim", sa.String(200), nullable=False),
        sa.Column("format", sa.Enum("xlsx", "docx", name="format_enum"), nullable=False),
        sa.Column("dosya_yolu", sa.String(500), nullable=False),
        sa.Column("alan_esleme", sa.JSON, nullable=False),
        sa.Column("aktif", sa.Boolean, default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    op.create_table(
        "raporlar",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("santiye_id", sa.String(36), sa.ForeignKey("santiyeler.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sablon_id", sa.String(36), sa.ForeignKey("sablonlar.id", ondelete="SET NULL"), nullable=True),
        sa.Column("olusturan_id", sa.String(36), sa.ForeignKey("kullanicilar.id", ondelete="SET NULL"), nullable=True),
        sa.Column("tarih", sa.Date, nullable=False),
        sa.Column("durum", sa.Enum("taslak", "onaylandi", "iptal", name="durum_enum"), default="taslak"),
        sa.Column("cikti_dosya_yolu", sa.String(500)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index("ix_raporlar_santiye_id", "raporlar", ["santiye_id"])
    op.create_index("ix_raporlar_tarih", "raporlar", ["tarih"])

    op.create_table(
        "whatsapp_mesajlari",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("santiye_id", sa.String(36), sa.ForeignKey("santiyeler.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rapor_id", sa.String(36), sa.ForeignKey("raporlar.id", ondelete="SET NULL"), nullable=True),
        sa.Column("gonderen_no", sa.String(30), nullable=False),
        sa.Column("icerik", sa.Text),
        sa.Column("medya_url", sa.String(1000)),
        sa.Column("islendi", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_whatsapp_mesajlari_santiye_id", "whatsapp_mesajlari", ["santiye_id"])
    op.create_index("ix_whatsapp_mesajlari_islendi", "whatsapp_mesajlari", ["islendi"])

    op.create_table(
        "cikarilanlar",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("mesaj_id", sa.String(36), sa.ForeignKey("whatsapp_mesajlari.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rapor_id", sa.String(36), sa.ForeignKey("raporlar.id", ondelete="CASCADE"), nullable=False),
        sa.Column("alan_adi", sa.String(100), nullable=False),
        sa.Column("deger", sa.Text),
        sa.Column("guven_skoru", sa.Float, default=1.0),
        sa.Column("belirsiz", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("cikarilanlar")
    op.drop_table("whatsapp_mesajlari")
    op.drop_table("raporlar")
    op.drop_table("sablonlar")
    op.drop_table("santiyeler")
    op.drop_table("kullanicilar")
    op.drop_table("musteriler")
    op.execute("DROP TYPE IF EXISTS plan_enum")
    op.execute("DROP TYPE IF EXISTS rol_enum")
    op.execute("DROP TYPE IF EXISTS format_enum")
    op.execute("DROP TYPE IF EXISTS durum_enum")
