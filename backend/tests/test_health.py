# backend/tests/test_health.py — the endpoint external uptime monitors ping.
from sqlalchemy import create_engine, text


def test_health_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_health_reports_db_outage_as_503(client, db_engine):
    """Regression test: an earlier version of this handler used
    Depends(get_db), which raises during dependency resolution on a
    connection failure — before the handler's own try/except could run —
    producing an unhandled 500 instead of a clean 503. This simulates a
    real outage (blocks new connections, kills existing ones) the same way
    it was verified by hand before the fix shipped."""
    dbname = db_engine.url.database
    admin_engine = create_engine(db_engine.url.set(database="postgres"))
    try:
        with admin_engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.execute(text("UPDATE pg_database SET datallowconn = false WHERE datname = :d"), {"d": dbname})
            conn.execute(
                text(
                    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                    "WHERE datname = :d AND pid <> pg_backend_pid()"
                ),
                {"d": dbname},
            )

        r = client.get("/health")
        assert r.status_code == 503
        assert r.json()["status"] == "down"
    finally:
        with admin_engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.execute(text("UPDATE pg_database SET datallowconn = true WHERE datname = :d"), {"d": dbname})
        admin_engine.dispose()

    # Confirm the app actually recovers once the DB is reachable again.
    r = client.get("/health")
    assert r.status_code == 200
