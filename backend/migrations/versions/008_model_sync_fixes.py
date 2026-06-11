"""Model-DB senkronizasyon düzeltmeleri

Revision ID: 008
Revises: 007
Create Date: 2026-06-02

Değişiklikler:
  - pending_whatsapp.olusturma_tarihi nullable=True yapıldı (model ile uyumlu)
  - ix_pending_whatsapp_whatsapp_numara unique=True olarak yeniden oluşturuldu
  - santiyeler.whatsapp_numara için duplicate unique constraint kaldırıldı,
    unique=True index yeniden oluşturuldu
"""

from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ----------------------------------------------------------------
    # 1. pending_whatsapp.olusturma_tarihi — nullable=True
    #    SQLite ALTER COLUMN desteklemez; batch mode kullanıyoruz.
    # ----------------------------------------------------------------
    with op.batch_alter_table("pending_whatsapp") as batch_op:
        batch_op.alter_column(
            "olusturma_tarihi",
            existing_type=sa.DateTime(timezone=True),
            existing_server_default=sa.func.now(),
            nullable=True,
        )

    # ----------------------------------------------------------------
    # 2. pending_whatsapp.whatsapp_numara — unique index yeniden oluştur
    # ----------------------------------------------------------------
    op.drop_index("ix_pending_whatsapp_whatsapp_numara", table_name="pending_whatsapp")
    op.create_index(
        "ix_pending_whatsapp_whatsapp_numara",
        "pending_whatsapp",
        ["whatsapp_numara"],
        unique=True,
    )

    # ----------------------------------------------------------------
    # 3. santiyeler.whatsapp_numara — eski unique constraint + eski index
    #    kaldır, sonra unique=True index oluştur
    # ----------------------------------------------------------------
    with op.batch_alter_table("santiyeler") as batch_op:
        # SQLite unique constraint'leri index olarak saklar;
        # drop_constraint yerine drop_index yeterli.
        try:
            batch_op.drop_constraint("uq_santiyeler_whatsapp_numara", type_="unique")
        except Exception:
            pass  # Constraint yoksa (SQLite) sessizce geç

    op.drop_index("ix_santiyeler_whatsapp_numara", table_name="santiyeler")
    op.create_index(
        "ix_santiyeler_whatsapp_numara",
        "santiyeler",
        ["whatsapp_numara"],
        unique=True,
    )


def downgrade() -> None:
    # santiyeler — unique index geri al, unique=False index oluştur
    op.drop_index("ix_santiyeler_whatsapp_numara", table_name="santiyeler")
    op.create_index(
        "ix_santiyeler_whatsapp_numara",
        "santiyeler",
        ["whatsapp_numara"],
        unique=False,
    )

    # pending_whatsapp — unique index geri al
    op.drop_index("ix_pending_whatsapp_whatsapp_numara", table_name="pending_whatsapp")
    op.create_index(
        "ix_pending_whatsapp_whatsapp_numara",
        "pending_whatsapp",
        ["whatsapp_numara"],
        unique=False,
    )

    # pending_whatsapp.olusturma_tarihi — nullable=False geri al
    with op.batch_alter_table("pending_whatsapp") as batch_op:
        batch_op.alter_column(
            "olusturma_tarihi",
            existing_type=sa.DateTime(timezone=True),
            existing_server_default=sa.func.now(),
            nullable=False,
        )
