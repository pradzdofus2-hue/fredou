#!/usr/bin/env python3
"""Check missing card art and find exact-name monster candidates from local dofus.sqlite.
Does not alter existing cards or images.
"""
import sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
ASSETS=Path.home()/"Desktop"/"fredou-dofus-assets"
MISSING={43:"Goultard",44:"Otomaï",46:"Rushu",47:"Djaul",48:"Dieu Iop",62:"Kolosso",64:"N",72:"Dieu Xélor"}
db_path=ASSETS/"dofus.sqlite"
if not db_path.exists(): raise SystemExit(f"Fichier introuvable: {db_path}")
db=sqlite3.connect(str(db_path))
for num,name in MISSING.items():
    dest=ROOT/"public"/"art"/"dofus"/f"{num}.png"
    print(f"\n#{num} {name} => {'PNG PRESENT' if dest.is_file() else 'PNG MANQUANT'}")
    if name in ("Kolosso","N"):
        try:
            rows=db.execute('''SELECT m.id, m.gfxId, t.value
            FROM MonsterData m JOIN translations t ON t.id=m.nameId AND t.lang='fr'
            WHERE lower(trim(t.value))=lower(?) ORDER BY m.id LIMIT 15''',(name,)).fetchall()
            for mid,gfx,nom in rows:
                path=next((p for p in (ASSETS/"monsters"/"2x"/f"{gfx}.png",ASSETS/"monsters"/"1x"/f"{gfx}.png",ASSETS/"2x"/f"{gfx}.png") if p.exists()),None)
                print(f"  MonsterData {mid}: gfxId={gfx}; PNG={path}")
            if not rows: print("  Aucune correspondance exacte dans MonsterData.")
        except sqlite3.Error as e: print(f"  Recherche impossible: {e}")
db.close()
print("\nPour les PNJ et dieux, utiliser des illustrations verifiees, pas des monstres ressemblants.")
