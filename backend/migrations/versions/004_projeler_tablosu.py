"""projeler tablosunu oluştur

Revision ID: 004
Revises: 003
Create Date: 2026-06-01

Değişiklikler:
  - projeler tablosu oluşturulur.
"""

from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "projeler",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "musteri_id",
            sa.String(36),
            sa.ForeignKey("musteriler.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "santiye_id",
            sa.String(36),
            sa.ForeignKey("santiyeler.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("isim", sa.String(200), nullable=False),
        sa.Column("tanim", sa.Text, nullable=True),
        sa.Column(
            "durum",
            sa.Enum("aktif", "pasif", "arsiv", name="proje_durum_enum", native_enum=False),
            nullable=False,
            server_default="aktif",
        ),
        sa.Column("baslangic_tarihi", sa.Date, nullable=True),
        sa.Column("bitis_tarihi", sa.Date, nullable=True),
        sa.Column("il", sa.String(100), nullable=True),
        sa.Column("ilce", sa.String(100), nullable=True),
        sa.Column("enlem", sa.Float, nullable=True),
        sa.Column("boylam", sa.Float, nullable=True),
        sa.Column("proje_muduru", sa.String(200), nullable=True),
        sa.Column("butce", sa.Float, nullable=True),
        sa.Column("ilerleme_yuzdesi", sa.Float, nullable=True, server_default="0"),
        sa.Column("created_at", sa.String(50), nullable=True),
        sa.Column("updated_at", sa.String(50), nullable=True),
    )
    # index=True kolonlarda zaten oluşturuyor; tekrar çağırmaya gerek yok


def downgrade() -> None:
    op.drop_index("ix_projeler_santiye_id", table_name="projeler")
    op.drop_index("ix_projeler_musteri_id", table_name="projeler")
    op.drop_table("projeler")
    # native_enum=False kullandığımız için PostgreSQL'de ayrı TYPE oluşturulmadı;
    # DROP TYPE çağrısı gereksiz — satır kaldırıldı.
