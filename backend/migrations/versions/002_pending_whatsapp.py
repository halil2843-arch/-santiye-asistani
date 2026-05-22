"""pending_whatsapp tablosu ve santiyeler.whatsapp_numara kolonu

Revision ID: 002
Revises: 001
Create Date: 2026-05-07

Değişiklikler:
  1. santiyeler tablosuna whatsapp_numara kolonu eklenir (nullable, unique).
  2. pending_whatsapp tablosu oluşturulur.
"""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. santiyeler tablosuna whatsapp_numara kolonu ekle (batch mode — SQLite için zorunlu)
    with op.batch_alter_table("santiyeler") as batch_op:
        batch_op.add_column(sa.Column("whatsapp_numara", sa.String(30), nullable=True))
        batch_op.create_unique_constraint("uq_santiyeler_whatsapp_numara", ["whatsapp_numara"])
        batch_op.create_index("ix_santiyeler_whatsapp_numara", ["whatsapp_numara"])

    # 2. pending_whatsapp tablosunu oluştur
    op.create_table(
        "pending_whatsapp",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("whatsapp_numara", sa.String(30), nullable=False, unique=True),
        sa.Column("ilk_mesaj_metni", sa.Text, nullable=True),
        sa.Column(
            "olusturma_tarihi",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("islendi", sa.Boolean, nullable=False, default=False),
    )
    op.create_index("ix_pending_whatsapp_whatsapp_numara", "pending_whatsapp", ["whatsapp_numara"])
    op.create_index("ix_pending_whatsapp_islendi", "pending_whatsapp", ["islendi"])


def downgrade() -> None:
    op.drop_index("ix_pending_whatsapp_islendi", table_name="pending_whatsapp")
    op.drop_index("ix_pending_whatsapp_whatsapp_numara", table_name="pending_whatsapp")
    op.drop_table("pending_whatsapp")

    with op.batch_alter_table("santiyeler") as batch_op:
        batch_op.drop_index("ix_santiyeler_whatsapp_numara")
        batch_op.drop_constraint("uq_santiyeler_whatsapp_numara", type_="unique")
        batch_op.drop_column("whatsapp_numara")
