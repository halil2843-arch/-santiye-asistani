"""puantaj_devamsizlik_nedeni

Revision ID: 010
Revises: 009
Create Date: 2026-06-08

puantaj_kayitlari tablosuna devamsizlik_nedeni (String 100, nullable) alanı ekler.
"""

from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("puantaj_kayitlari") as batch_op:
        batch_op.add_column(
            sa.Column("devamsizlik_nedeni", sa.String(100), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("puantaj_kayitlari") as batch_op:
        batch_op.drop_column("devamsizlik_nedeni")
