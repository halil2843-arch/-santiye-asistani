"""proje_notlari

Revision ID: 012
Revises: 011
Create Date: 2026-06-08

Proje bazlı yapışkan not tablosu ekler.
"""

from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "proje_notlari",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("proje_id", sa.String(36), nullable=False, index=True),
        sa.Column("musteri_id", sa.String(36), nullable=False, index=True),
        sa.Column("baslik", sa.String(200), nullable=False),
        sa.Column("icerik", sa.Text, nullable=False),
        sa.Column("renk", sa.String(20), nullable=True),
        sa.Column("sabitlendi", sa.String(5), nullable=True),
        sa.Column("created_at", sa.String(50), nullable=True),
        sa.Column("updated_at", sa.String(50), nullable=True),
    )


def downgrade() -> None:
    op.drop_index("ix_proje_notlari_proje_id", table_name="proje_notlari")
    op.drop_index("ix_proje_notlari_musteri_id", table_name="proje_notlari")
    op.drop_table("proje_notlari")
