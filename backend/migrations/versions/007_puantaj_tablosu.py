"""puantaj_kayitlari tablosunu oluştur

Revision ID: 007
Revises: 006
Create Date: 2026-06-02

Değişiklikler:
  - puantaj_kayitlari tablosu eklenir
    Alanlar: id, musteri_id, proje_id, santiye_id, tarih, personel_adi,
             meslek, giris_saati, cikis_saati, calisma_saati, fazla_mesai,
             devamsizlik, notlar, created_at
"""

from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "puantaj_kayitlari",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "musteri_id",
            sa.String(36),
            sa.ForeignKey("musteriler.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "proje_id",
            sa.String(36),
            sa.ForeignKey("projeler.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "santiye_id",
            sa.String(36),
            sa.ForeignKey("santiyeler.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("tarih", sa.String(20), nullable=False),
        sa.Column("personel_adi", sa.String(200), nullable=False),
        sa.Column("meslek", sa.String(100), nullable=True),
        sa.Column("giris_saati", sa.String(10), nullable=True),
        sa.Column("cikis_saati", sa.String(10), nullable=True),
        sa.Column("calisma_saati", sa.Float(), nullable=True, server_default="8.0"),
        sa.Column("fazla_mesai", sa.Float(), nullable=True, server_default="0.0"),
        sa.Column("devamsizlik", sa.Boolean(), nullable=True, server_default="0"),
        sa.Column("notlar", sa.Text(), nullable=True),
        sa.Column("created_at", sa.String(50), nullable=True),
    )

    op.create_index("ix_puantaj_kayitlari_musteri_id", "puantaj_kayitlari", ["musteri_id"])
    op.create_index("ix_puantaj_kayitlari_proje_id", "puantaj_kayitlari", ["proje_id"])
    op.create_index("ix_puantaj_kayitlari_santiye_id", "puantaj_kayitlari", ["santiye_id"])
    op.create_index("ix_puantaj_kayitlari_tarih", "puantaj_kayitlari", ["tarih"])


def downgrade() -> None:
    op.drop_index("ix_puantaj_kayitlari_tarih", "puantaj_kayitlari")
    op.drop_index("ix_puantaj_kayitlari_santiye_id", "puantaj_kayitlari")
    op.drop_index("ix_puantaj_kayitlari_proje_id", "puantaj_kayitlari")
    op.drop_index("ix_puantaj_kayitlari_musteri_id", "puantaj_kayitlari")
    op.drop_table("puantaj_kayitlari")
