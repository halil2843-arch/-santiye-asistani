"""Faz 2 tabloları: stok, medya, isg, toplantı, aktivite

Revision ID: 005
Revises: 004
Create Date: 2026-06-01

Değişiklikler:
  - stok_kalemleri tablosu oluşturulur
  - stok_hareketleri tablosu oluşturulur
  - medya_dosyalari tablosu oluşturulur
  - isg_kayitlari tablosu oluşturulur
  - toplantilar tablosu oluşturulur
  - aktiviteler tablosu oluşturulur
"""

from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------ stok_kalemleri
    op.create_table(
        "stok_kalemleri",
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
        sa.Column("malzeme_adi", sa.String(200), nullable=False),
        sa.Column("birim", sa.String(30), nullable=True),
        sa.Column("miktar", sa.Float, nullable=True, server_default="0"),
        sa.Column("min_miktar", sa.Float, nullable=True, server_default="0"),
        sa.Column("created_at", sa.String(50), nullable=True),
        sa.Column("updated_at", sa.String(50), nullable=True),
    )
    op.create_index("ix_stok_kalemleri_musteri_id", "stok_kalemleri", ["musteri_id"])
    op.create_index("ix_stok_kalemleri_proje_id", "stok_kalemleri", ["proje_id"])

    # ------------------------------------------------------------------ stok_hareketleri
    op.create_table(
        "stok_hareketleri",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "kalem_id",
            sa.String(36),
            sa.ForeignKey("stok_kalemleri.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "kullanici_id",
            sa.String(36),
            sa.ForeignKey("kullanicilar.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("tip", sa.String(20), nullable=False),
        sa.Column("miktar", sa.Float, nullable=False),
        sa.Column("aciklama", sa.Text, nullable=True),
        sa.Column("created_at", sa.String(50), nullable=True),
    )
    op.create_index("ix_stok_hareketleri_kalem_id", "stok_hareketleri", ["kalem_id"])

    # ------------------------------------------------------------------ medya_dosyalari
    op.create_table(
        "medya_dosyalari",
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
            "rapor_id",
            sa.String(36),
            sa.ForeignKey("raporlar.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("dosya_yolu", sa.String(1000), nullable=False),
        sa.Column("dosya_adi", sa.String(300), nullable=True),
        sa.Column("mime_type", sa.String(100), nullable=True),
        sa.Column("boyut_byte", sa.Integer, nullable=True),
        sa.Column("tip", sa.String(20), nullable=True, server_default="fotograf"),
        sa.Column("created_at", sa.String(50), nullable=True),
    )
    op.create_index("ix_medya_dosyalari_musteri_id", "medya_dosyalari", ["musteri_id"])
    op.create_index("ix_medya_dosyalari_proje_id", "medya_dosyalari", ["proje_id"])

    # ------------------------------------------------------------------ isg_kayitlari
    op.create_table(
        "isg_kayitlari",
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
        sa.Column("tip", sa.String(30), nullable=False),
        sa.Column("tarih", sa.String(20), nullable=False),
        sa.Column("aciklama", sa.Text, nullable=True),
        sa.Column("sonuc", sa.Text, nullable=True),
        sa.Column("onem_seviyesi", sa.String(20), nullable=True, server_default="orta"),
        sa.Column("durum", sa.String(20), nullable=True, server_default="acik"),
        sa.Column("sorumlu", sa.String(200), nullable=True),
        sa.Column("created_at", sa.String(50), nullable=True),
    )
    op.create_index("ix_isg_kayitlari_musteri_id", "isg_kayitlari", ["musteri_id"])
    op.create_index("ix_isg_kayitlari_proje_id", "isg_kayitlari", ["proje_id"])

    # ------------------------------------------------------------------ toplantilar
    op.create_table(
        "toplantilar",
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
        sa.Column("baslik", sa.String(300), nullable=False),
        sa.Column("tarih", sa.String(50), nullable=False),
        sa.Column("yer", sa.String(200), nullable=True),
        sa.Column("notlar", sa.Text, nullable=True),
        sa.Column("katilanlar", sa.Text, nullable=True),
        sa.Column("created_at", sa.String(50), nullable=True),
    )
    op.create_index("ix_toplantilar_musteri_id", "toplantilar", ["musteri_id"])
    op.create_index("ix_toplantilar_proje_id", "toplantilar", ["proje_id"])

    # ------------------------------------------------------------------ aktiviteler
    op.create_table(
        "aktiviteler",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "proje_id",
            sa.String(36),
            sa.ForeignKey("projeler.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "musteri_id",
            sa.String(36),
            sa.ForeignKey("musteriler.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "kullanici_id",
            sa.String(36),
            sa.ForeignKey("kullanicilar.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("tip", sa.String(50), nullable=True),
        sa.Column("baslik", sa.String(300), nullable=True),
        sa.Column("aciklama", sa.Text, nullable=True),
        sa.Column("renk", sa.String(20), nullable=True, server_default="blue"),
        sa.Column("created_at", sa.String(50), nullable=True),
    )
    op.create_index("ix_aktiviteler_proje_id", "aktiviteler", ["proje_id"])
    op.create_index("ix_aktiviteler_musteri_id", "aktiviteler", ["musteri_id"])


def downgrade() -> None:
    op.drop_index("ix_aktiviteler_musteri_id", table_name="aktiviteler")
    op.drop_index("ix_aktiviteler_proje_id", table_name="aktiviteler")
    op.drop_table("aktiviteler")

    op.drop_index("ix_toplantilar_proje_id", table_name="toplantilar")
    op.drop_index("ix_toplantilar_musteri_id", table_name="toplantilar")
    op.drop_table("toplantilar")

    op.drop_index("ix_isg_kayitlari_proje_id", table_name="isg_kayitlari")
    op.drop_index("ix_isg_kayitlari_musteri_id", table_name="isg_kayitlari")
    op.drop_table("isg_kayitlari")

    op.drop_index("ix_medya_dosyalari_proje_id", table_name="medya_dosyalari")
    op.drop_index("ix_medya_dosyalari_musteri_id", table_name="medya_dosyalari")
    op.drop_table("medya_dosyalari")

    op.drop_index("ix_stok_hareketleri_kalem_id", table_name="stok_hareketleri")
    op.drop_table("stok_hareketleri")

    op.drop_index("ix_stok_kalemleri_proje_id", table_name="stok_kalemleri")
    op.drop_index("ix_stok_kalemleri_musteri_id", table_name="stok_kalemleri")
    op.drop_table("stok_kalemleri")
