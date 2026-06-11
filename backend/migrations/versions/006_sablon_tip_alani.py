"""sablonlar tablosuna tip alanı ekle

Revision ID: 006
Revises: 005
Create Date: 2026-06-01

Değişiklikler:
  - sablonlar.tip alanı eklenir (String 50, nullable, default 'gunluk_rapor')
  - Olası değerler: gunluk_rapor, hakedis, isg, puantaj, aylik_ozet, diger
"""

from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sablonlar",
        sa.Column("tip", sa.String(50), nullable=True, server_default="gunluk_rapor"),
    )


def downgrade() -> None:
    op.drop_column("sablonlar", "tip")
