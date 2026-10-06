import argparse
from datetime import datetime, timezone

from sqlalchemy import text

from app.database import SessionLocal
from app.meta.config import META_API_VERSION
from app.meta.crypto import encrypt_token
from app.meta.service import upsert_discovered_assets


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed one isolated Tynato Meta mock connection")
    parser.add_argument("--team-id", required=True, help="Existing Tynato team UUID")
    parser.add_argument(
        "--user-id",
        required=True,
        help="Existing Tynato profile UUID used as connected_by_user_id",
    )
    args = parser.parse_args()

    from app.meta.config import META_ALLOW_MOCK, META_PROVIDER
    if META_PROVIDER != "mock" or not META_ALLOW_MOCK:
        raise RuntimeError(
            "Mock seed requires META_PROVIDER=mock and META_ALLOW_MOCK=true"
        )

    db = SessionLocal()
    try:
        existing = db.execute(
            text("SELECT id FROM meta_connections WHERE team_id = :team_id"),
            {"team_id": args.team_id},
        ).scalar()
        if existing:
            raise RuntimeError(
                "Team already has a Meta connection. Refusing to overwrite it: {}".format(existing)
            )

        connection = db.execute(
            text(
                """
                INSERT INTO meta_connections (
                    team_id, connected_by_user_id, meta_user_id,
                    granted_scopes, status, api_version, last_validated_at
                )
                VALUES (
                    :team_id, :user_id, 'mock-meta-user-001',
                    ARRAY[
                        'business_management', 'ads_read', 'pages_show_list',
                        'pages_read_engagement', 'pages_manage_metadata'
                    ]::TEXT[],
                    'active', :api_version, NOW()
                )
                RETURNING id
                """
            ),
            {"team_id": args.team_id, "user_id": args.user_id, "api_version": META_API_VERSION},
        ).scalar_one()

        db.execute(
            text(
                """
                INSERT INTO meta_credentials (
                    connection_id, credential_kind, asset_external_id,
                    encrypted_token, key_version
                )
                VALUES (
                    :connection_id, 'user_access_token', NULL,
                    :encrypted_token, 1
                )
                """
            ),
            {
                "connection_id": connection,
                "encrypted_token": encrypt_token("mock-user-token"),
            },
        )
        db.commit()

        summary = upsert_discovered_assets(
            db,
            connection,
            args.team_id,
            "mock-user-token",
        )
        db.commit()

        print(
            "Seeded mock Meta connection {} at {}: {}".format(
                connection,
                datetime.now(timezone.utc).isoformat(),
                summary,
            )
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
