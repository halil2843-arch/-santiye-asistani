"""stok_hareketi_tarih

Revision ID: 011
Revises: 010
Create Date: 2026-06-08

stok_hareketleri tablosuna tarih (String 50, nullable) audit trail alanı ekler.
"""

from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("stok_hareketleri") as batch_op:
        batch_op.add_column(
            sa.Column("tarih", sa.String(50), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("stok_hareketleri") as batch_op:
        batch_op.drop_column("tarih")
