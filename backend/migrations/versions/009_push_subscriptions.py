"""push_subscriptions tablosu

Revision ID: 009
Revises: 008
Create Date: 2026-06-03
"""

from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("musteri_id", sa.String(36), nullable=False),
        sa.Column("endpoint", sa.Text, nullable=False),
        sa.Column("p256dh", sa.Text, nullable=False),
        sa.Column("auth", sa.Text, nullable=False),
        sa.Column("created_at", sa.String(50), nullable=True),
    )
    op.create_index("ix_push_subscriptions_musteri_id", "push_subscriptions", ["musteri_id"])


def downgrade() -> None:
    op.drop_index("ix_push_subscriptions_musteri_id", table_name="push_subscriptions")
    op.drop_table("push_subscriptions")
