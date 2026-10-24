#!/usr/bin/env python3
"""Safely transfer FREDOU's existing local SQLite rows into the private Supabase schema.

Prerequisites: pip install "psycopg[binary]"
Set SUPABASE_DB_URL privately in your shell; never commit or print it.
Default is dry run. Use --apply only after a backup and reviewing row counts.
Works only with the tables created by the initialize_fredou_private_game_schema migration.
"""
from __future__ import annotations
import argparse
import os
import sqlite3
import sys
from pathlib import Path

TABLES = [
    "migrations", "users", "sessions", "oauth_states", "auth_receipts",
    "series", "cards", "inventory", "events", "boosters", "user_boosters",
    "openings", "ledger", "listings", "trades", "achievements",
    "user_achievements", "acquisitions", "activities", "price_history",
    "idempotency", "referral_rewards", "event_rewards", "news", "settings",
]

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--sqlite", default="data/fredou.sqlite")
    p.add_argument("--apply", action="store_true")
    args = p.parse_args()
    dbfile = Path(args.sqlite).resolve()
    if not dbfile.is_file():
        sys.exit(f"SQLite introuvable : {dbfile}")
    sqlite = sqlite3.connect(f"file:{dbfile.as_posix()}?mode=ro", uri=True)
    counts = {}
    for table in TABLES:
        counts[table] = sqlite.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
        print(f"{table}: {counts[table]}")
    print(f"TOTAL : {sum(counts.values())} lignes")
    if not args.apply:
        print("Simulation uniquement. Sauvegarde SQLite + --apply requis.")
        return
    url = os.getenv("SUPABASE_DB_URL")
    if not url:
        sys.exit("Variable SUPABASE_DB_URL manquante. Ne la partage pas.")
    try:
        import psycopg
        from psycopg import sql
    except ImportError:
        sys.exit('Installe psycopg avec : python -m pip install "psycopg[binary]"')
    with psycopg.connect(url, connect_timeout=15) as pg:
        with pg.transaction():
            # Avoid applying the same import twice, or overwriting server activity.
            with pg.cursor() as cur:
                for table in TABLES:
                    cur.execute(
                        sql.SQL("SELECT COUNT(*) FROM {}.{}").format(
                            sql.Identifier("fredou"), sql.Identifier(table)))
                    existing = cur.fetchone()[0]
                    if existing:
                        raise RuntimeError(f"Import refuse : fredou.{table} contient deja {existing} lignes")
                for table in TABLES:
                    cursor = sqlite.execute(f'SELECT * FROM "{table}"')
                    columns = [x[0] for x in cursor.description]
                    statement = sql.SQL("INSERT INTO {}.{} ({}) VALUES ({})").format(
                        sql.Identifier("fredou"), sql.Identifier(table),
                        sql.SQL(",").join(map(sql.Identifier, columns)),
                        sql.SQL(",").join(sql.Placeholder() for _ in columns))
                    with pg.cursor() as cur:
                        while True:
                            batch = cursor.fetchmany(500)
                            if not batch:
                                break
                            cur.executemany(statement, batch)
                    print(f"Import : {table} ({counts[table]} lignes)")
                for table in TABLES:
                    cur.execute(
                        sql.SQL("SELECT COUNT(*) FROM {}.{}").format(
                            sql.Identifier("fredou"), sql.Identifier(table)))
                    n = cur.fetchone()[0]
                    if n != counts[table]:
                        raise RuntimeError(f"Verification echouee pour {table}: {n} != {counts[table]}")
        print("Import termine. Toutes les quantites verifiees.")
    sqlite.close()

if __name__ == "__main__":
    main()
