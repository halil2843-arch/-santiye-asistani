"""medya_klasor

Revision ID: 013
Revises: 012
Create Date: 2026-06-08

MedyaDosyasi tablosuna galeri klasör desteği ekler.
"""

from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("medya_dosyalari") as batch_op:
        batch_op.add_column(sa.Column("klasor", sa.String(100), nullable=True))
    op.create_index("ix_medya_dosyalari_klasor", "medya_dosyalari", ["klasor"])


def downgrade() -> None:
    op.drop_index("ix_medya_dosyalari_klasor", table_name="medya_dosyalari")
    with op.batch_alter_table("medya_dosyalari") as batch_op:
        batch_op.drop_column("klasor")
