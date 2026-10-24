#!/usr/bin/env python3
"""Import only public FREDOU catalogue/configuration data to Supabase.

Does not upload accounts, sessions, inventory, balances or transactions.
Requires: python -m pip install "psycopg[binary]"
Pass --apply to write, after setting SUPABASE_DB_URL privately.
"""
import argparse
import os
import sqlite3
from pathlib import Path

TABLES = ("series", "cards", "events", "boosters", "achievements", "news", "settings")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sqlite", default="data/fredou.sqlite")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    path = Path(args.sqlite).resolve()
    if not path.is_file():
        parser.error(f"SQLite introuvable: {path}")
    source = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
    # Use an immutable consistent copy of the local catalogue when writing.
    snapshot = None
    if args.apply:
        import tempfile
        snapshot = tempfile.TemporaryDirectory(prefix="fredou-catalog-")
        copied = Path(snapshot.name) / "catalog.sqlite"
        with sqlite3.connect(copied) as target:
            source.backup(target)
        source.close()
        source = sqlite3.connect(f"file:{copied.as_posix()}?mode=ro", uri=True)
    try:
        counts = {}
        for table in TABLES:
            counts[table] = source.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
            print(f"{table}: {counts[table]}")
        if not args.apply:
            print("Simulation uniquement: ajoutez --apply pour l'import du catalogue public.")
            return
        url = os.environ.get("SUPABASE_DB_URL")
        if not url:
            parser.error("SUPABASE_DB_URL manquante. Ne partagez jamais cette URL.")
        import psycopg
        from psycopg import sql
        with psycopg.connect(url, connect_timeout=15) as pg:
            with pg.transaction():
                with pg.cursor() as cur:
                    # Never overwrite an existing catalogue or run against wrong database.
                    cur.execute("SELECT to_regclass('fredou.cards')")
                    if cur.fetchone()[0] is None:
                        raise RuntimeError("Schéma fredou absent; import annulé.")
                    for table in TABLES:
                        cur.execute(sql.SQL("SELECT COUNT(*) FROM fredou.{}").format(sql.Identifier(table)))
                        if cur.fetchone()[0]:
                            raise RuntimeError(f"Table fredou.{table} non vide, import annulé.")
                    for table in TABLES:
                        cursor = source.execute(f'SELECT * FROM "{table}"')
                        columns = [c[0] for c in cursor.description]
                        insert = sql.SQL("INSERT INTO fredou.{} ({}) VALUES ({})").format(
                            sql.Identifier(table),
                            sql.SQL(", ").join(sql.Identifier(c) for c in columns),
                            sql.SQL(", ").join(sql.Placeholder() for _ in columns)
                        )
                        for _ in range(1000000):
                            rows = cursor.fetchmany(500)
                            if not rows:
                                break
                            cur.executemany(insert, rows)
                        cur.execute(sql.SQL("SELECT COUNT(*) FROM fredou.{}").format(sql.Identifier(table)))
                        actual = cur.fetchone()[0]
                        if actual != counts[table]:
                            raise RuntimeError(f"Comptage incorrect pour {table}: {actual} != {counts[table]}")
                        print(f"OK {table}: {actual}")
        print("Catalogue public importé. Aucun compte ou inventaire transféré.")
    finally:
        source.close()
        if snapshot:
            snapshot.cleanup()

if __name__ == "__main__":
    main()
