"""santiyeler tablosuna konum ve arsiv kolonları

Revision ID: 003
Revises: 002
Create Date: 2026-06-01

Değişiklikler:
  - santiyeler tablosuna il, ilce, enlem, boylam, arsiv kolonları eklenir.
"""

from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("santiyeler") as batch_op:
        batch_op.add_column(sa.Column("il", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("ilce", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("enlem", sa.Float, nullable=True))
        batch_op.add_column(sa.Column("boylam", sa.Float, nullable=True))
        batch_op.add_column(
            sa.Column(
                "arsiv",
                sa.Boolean,
                nullable=False,
                server_default="0",
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("santiyeler") as batch_op:
        batch_op.drop_column("arsiv")
        batch_op.drop_column("boylam")
        batch_op.drop_column("enlem")
        batch_op.drop_column("ilce")
        batch_op.drop_column("il")
