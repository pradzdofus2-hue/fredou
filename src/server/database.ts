import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { BOOSTERS, GAME_CONFIG, isDevelopmentMode, validateConfig } from './config';
import { CARDS, SERIES } from './catalog';

const globalDatabase = globalThis as typeof globalThis & { fredouDatabases?: Map<string, DatabaseSync> };
const connections = globalDatabase.fredouDatabases ??= new Map<string, DatabaseSync>();
export function getDb(): DatabaseSync {
  // The database is runtime data, never a server bundle dependency.
  const path = resolve(/* turbopackIgnore: true */ process.env.DATABASE_PATH || process.env.DB_PATH || 'data/fredou.sqlite');
  let connection = connections.get(path);
  if (!connection) {
    mkdirSync(dirname(path), { recursive: true });
    connection = new DatabaseSync(path);
    connection.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=10000; PRAGMA synchronous=FULL;');
    migrate(connection); seed(connection);
    connections.set(path, connection);
  }
  return connection;
}
export function all<T>(sql: string, ...params: SQLInputValue[]): T[] { return getDb().prepare(sql).all(...params) as unknown as T[]; }
export function one<T>(sql: string, ...params: SQLInputValue[]): T | undefined { return getDb().prepare(sql).get(...params) as unknown as T | undefined; }
export function now(): string { return new Date().toISOString(); }
export function id(): string { return randomUUID(); }
export function transaction<T>(fn: () => T): T {
  const db = getDb(); db.exec('BEGIN IMMEDIATE');
  try { const result = fn(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function migrate(db: DatabaseSync = getDb()): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL, avatar TEXT, discord_id TEXT UNIQUE,
      mode TEXT NOT NULL CHECK(mode IN ('development','discord')), role TEXT NOT NULL DEFAULT 'player' CHECK(role IN ('player','admin')),
      balance INTEGER NOT NULL DEFAULT 0 CHECK(balance >= 0 AND balance <= 1000000000), reduced_motion INTEGER NOT NULL DEFAULT 0 CHECK(reduced_motion IN(0,1)),
      referral_code TEXT NOT NULL UNIQUE, referred_by TEXT REFERENCES users(id) ON DELETE SET NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS oauth_states (state_hash TEXT PRIMARY KEY, expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS auth_receipts (id TEXT PRIMARY KEY, action_hash TEXT NOT NULL, response TEXT NOT NULL, expires_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS series (id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL,color TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cards (id TEXT PRIMARY KEY, number INTEGER NOT NULL UNIQUE, name TEXT NOT NULL, rarity INTEGER NOT NULL CHECK(rarity BETWEEN 0 AND 5), series_id TEXT NOT NULL REFERENCES series(id), description TEXT NOT NULL, image TEXT NOT NULL,recycle_value INTEGER NOT NULL CHECK(recycle_value>0),collection_points INTEGER NOT NULL CHECK(collection_points>0));
    CREATE INDEX IF NOT EXISTS idx_cards_series_rarity ON cards(series_id,rarity);
    CREATE TABLE IF NOT EXISTS inventory (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,card_id TEXT NOT NULL REFERENCES cards(id),quantity INTEGER NOT NULL CHECK(quantity>=0),favorite INTEGER NOT NULL DEFAULT 0,first_obtained_at TEXT NOT NULL,last_obtained_at TEXT NOT NULL,PRIMARY KEY(user_id,card_id));
    CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL,starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,active INTEGER NOT NULL,color TEXT NOT NULL,reward INTEGER NOT NULL CHECK(reward>=0),CHECK(ends_at>starts_at));
    CREATE TABLE IF NOT EXISTS boosters (id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL,kind TEXT NOT NULL,price INTEGER NOT NULL CHECK(price>=0),color TEXT NOT NULL,guarantee INTEGER NOT NULL,weights TEXT NOT NULL,pity_limit INTEGER NOT NULL,cooldown_seconds INTEGER NOT NULL,event_id TEXT REFERENCES events(id),series_id TEXT REFERENCES series(id),capacity INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS user_boosters (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,booster_id TEXT NOT NULL REFERENCES boosters(id),available INTEGER NOT NULL DEFAULT 0 CHECK(available>=0),last_refill TEXT NOT NULL,pity_count INTEGER NOT NULL DEFAULT 0 CHECK(pity_count>=0),PRIMARY KEY(user_id,booster_id));
    CREATE TABLE IF NOT EXISTS openings (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,booster_id TEXT NOT NULL REFERENCES boosters(id),created_at TEXT NOT NULL,cards TEXT NOT NULL,shards_reward INTEGER NOT NULL,pity_triggered INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_openings_user_date ON openings(user_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS ledger (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,amount INTEGER NOT NULL,balance_after INTEGER NOT NULL CHECK(balance_after>=0),reason TEXT NOT NULL,created_at TEXT NOT NULL,reference_id TEXT);
    CREATE INDEX IF NOT EXISTS idx_ledger_user_date ON ledger(user_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS listings (id TEXT PRIMARY KEY,seller_id TEXT REFERENCES users(id) ON DELETE SET NULL,card_id TEXT NOT NULL REFERENCES cards(id),quantity INTEGER NOT NULL CHECK(quantity>0),price INTEGER NOT NULL CHECK(price>0),status TEXT NOT NULL CHECK(status IN('active','sold','cancelled')),buyer_id TEXT REFERENCES users(id) ON DELETE SET NULL,created_at TEXT NOT NULL,completed_at TEXT);
    CREATE INDEX IF NOT EXISTS idx_listings_status_card ON listings(status,card_id,price);
    CREATE TABLE IF NOT EXISTS trades (id TEXT PRIMARY KEY,sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,offered TEXT NOT NULL,requested TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN('pending','accepted','rejected','cancelled')),created_at TEXT NOT NULL,resolved_at TEXT,CHECK(sender_id<>recipient_id));
    CREATE INDEX IF NOT EXISTS idx_trades_recipient ON trades(recipient_id,status);
    CREATE TABLE IF NOT EXISTS achievements (id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL,icon TEXT NOT NULL,target INTEGER NOT NULL CHECK(target>0),reward INTEGER NOT NULL CHECK(reward>=0));
    CREATE TABLE IF NOT EXISTS user_achievements (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,achievement_id TEXT NOT NULL REFERENCES achievements(id),unlocked_at TEXT NOT NULL,PRIMARY KEY(user_id,achievement_id));
    CREATE TABLE IF NOT EXISTS acquisitions (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,card_id TEXT NOT NULL REFERENCES cards(id),quantity INTEGER NOT NULL CHECK(quantity>0),source TEXT NOT NULL,created_at TEXT NOT NULL,reference_id TEXT);
    CREATE INDEX IF NOT EXISTS idx_acquisitions_user_card ON acquisitions(user_id,card_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL,message TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS price_history (id TEXT PRIMARY KEY,listing_id TEXT NOT NULL UNIQUE REFERENCES listings(id),card_id TEXT NOT NULL REFERENCES cards(id),unit_price INTEGER NOT NULL CHECK(unit_price>0),quantity INTEGER NOT NULL CHECK(quantity>0),sold_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS idempotency (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,key TEXT NOT NULL,action_hash TEXT NOT NULL,response TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,key));
    CREATE TABLE IF NOT EXISTS referral_rewards (referred_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,referrer_id TEXT REFERENCES users(id) ON DELETE SET NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS event_rewards (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,event_id TEXT NOT NULL REFERENCES events(id),created_at TEXT NOT NULL,PRIMARY KEY(user_id,event_id));
    CREATE TABLE IF NOT EXISTS news (id TEXT PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,kind TEXT NOT NULL,published_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);
  `);
  db.prepare('INSERT OR IGNORE INTO migrations(version,applied_at) VALUES(1,?)').run(now());
}
export interface CreateUserOptions { id?: string; username: string; avatar?: string | null; discordId?: string | null; mode?: 'development' | 'discord'; role?: 'admin' | 'player'; }
function insertUser(db: DatabaseSync, opts: CreateUserOptions): string {
  const userId = opts.id || id(), date = now();
  db.prepare('INSERT INTO users(id,username,avatar,discord_id,mode,role,balance,referral_code,created_at) VALUES(?,?,?,?,?,?,0,?,?)')
    .run(userId, opts.username, opts.avatar || null, opts.discordId || null, opts.mode || 'development', opts.role || 'player', `FR-${id().slice(0, 8).toUpperCase()}`, date);
  const amount = opts.mode === 'discord' ? 300 : 1200;
  db.prepare('UPDATE users SET balance=? WHERE id=?').run(amount, userId);
  db.prepare('INSERT INTO ledger VALUES(?,?,?,?,?,?,?)').run(id(), userId, amount, amount, 'Bienvenue dans FREDOU COLLECTION', date, null);
  for (const booster of BOOSTERS) db.prepare('INSERT INTO user_boosters VALUES(?,?,?,?,0)').run(userId, booster.id, booster.kind === 'free' ? 3 : booster.kind === 'daily' ? 1 : 2, date);
  return userId;
}
export function createUser(opts: CreateUserOptions): string { return transaction(() => insertUser(getDb(), opts)); }
export function seed(db: DatabaseSync = getDb()): void {
  validateConfig();
  db.exec('BEGIN IMMEDIATE');
  try {
    if (db.prepare("SELECT value FROM settings WHERE key='seed_version'").get()) {
      // Configuration changes take effect on restart without resetting inventories or the economy.
      for (const b of BOOSTERS) db.prepare('UPDATE boosters SET name=?,description=?,price=?,color=?,guarantee=?,weights=?,pity_limit=?,cooldown_seconds=?,capacity=? WHERE id=?').run(b.name,b.description,b.price,b.color,b.guarantee,JSON.stringify(b.weights),b.pityLimit,b.cooldownSeconds,b.capacity,b.id);
      // Future recycling and current rankings use the current central configuration.
      // Historical ledger entries remain immutable: their original amounts are never rewritten.
      for (const rarity of GAME_CONFIG.rarities) db.prepare('UPDATE cards SET recycle_value=?,collection_points=? WHERE rarity=?').run(rarity.recycleValue,rarity.collectionPoints,rarity.id);
      db.exec('COMMIT'); return;
    }
    const date = now();
    for (const s of SERIES) db.prepare('INSERT OR IGNORE INTO series VALUES(?,?,?,?)').run(s.id,s.name,s.description,s.color);
    for (const c of CARDS) db.prepare('INSERT OR IGNORE INTO cards VALUES(?,?,?,?,?,?,?,?,?)').run(c.id,c.number,c.name,c.rarity,c.seriesId,c.description,c.image,c.recycleValue,c.collectionPoints);
    db.prepare('INSERT OR IGNORE INTO events VALUES(?,?,?,?,?,?,?,?)').run('convergence','La convergence des astres','Les citadelles d’Aetherion s’illuminent. Explorez leur booster et recevez une prime unique de 80 Éclats.',new Date(Date.now()-86400000).toISOString(),new Date(Date.now()+30*86400000).toISOString(),1,'#ad8aff',80);
    for (const b of BOOSTERS) db.prepare('INSERT OR IGNORE INTO boosters VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(b.id,b.name,b.description,b.kind,b.price,b.color,b.guarantee,JSON.stringify(b.weights),b.pityLimit,b.cooldownSeconds,b.eventId,b.seriesId,b.capacity);
    const achievementRows: [string,string,string,string,number,number][] = [
      ['first-opening','Premier éclat','Ouvrir votre premier booster.','sparkles',1,20],
      ['ten-unique','Une histoire commence','Posséder dix cartes différentes.','layers',10,30],
      ['first-legendary','Une légende se lève','Obtenir une carte Légendaire.','crown',1,60],
      ['first-mythic','Au-delà du mythe','Obtenir une carte Mythique.','star',1,150],
      ['first-album','Archiviste accompli','Compléter un album de vingt-quatre cartes.','book',1,200],
      ['first-recycle','Rien ne se perd','Recycler des doublons.','recycle',1,15],
      ['first-transaction','Les liens du marché','Acheter ou vendre une première annonce.','store',1,25],
      ['fifty-unique','Collection remarquable','Posséder cinquante cartes différentes.','gem',50,100],
      ['ten-openings','Le rituel des étoiles','Ouvrir dix boosters.','gift',10,75],
    ];
    for (const a of achievementRows) db.prepare('INSERT OR IGNORE INTO achievements VALUES(?,?,?,?,?,?)').run(...a);
    db.prepare('INSERT OR IGNORE INTO news VALUES(?,?,?,?,?)').run('welcome','Bienvenue dans les chroniques','Trois univers, soixante-douze cartes originales et une collection à façonner. Cette édition locale utilise uniquement des Éclats fictifs.','news',date);
    db.prepare('INSERT OR IGNORE INTO news VALUES(?,?,?,?,?)').run('convergence-news','Les astres se rencontrent','Le booster Convergence rassemble les habitants des Citadelles astrales pendant l’événement. Une première ouverture offre une récompense unique.','event',date);
    db.prepare('INSERT OR IGNORE INTO news VALUES(?,?,?,?,?)').run('launch','Carnet de mise à jour · 1.0','Ouvertures sécurisées, albums, marché entre joueurs, échanges et succès sont réunis dans cette première édition.','update',date);
    if (isDevelopmentMode()) {
      for (const [userId, username, role] of [['fredou','Fredou','admin'],['iris','Iris','player'],['noam','Noam','player']] as const) {
        insertUser(db,{id:userId,username,role,mode:'development'});
        const offset = userId === 'fredou' ? 0 : userId === 'iris' ? 11 : 25;
        const count = userId === 'fredou' ? 31 : userId === 'iris' ? 39 : 26;
        for (let n = 0; n < count; n++) {
          const card = CARDS[(n+offset)%72], quantity = n%5===0 ? 4 : n%3===0 ? 2 : 1;
          db.prepare('INSERT INTO inventory VALUES(?,?,?,?,?,?)').run(userId,card.id,quantity,n%11===0?1:0,date,date);
          db.prepare('INSERT INTO acquisitions VALUES(?,?,?,?,?,?,?)').run(id(),userId,card.id,quantity,'collection de démonstration',date,null);
        }
      }
      for (const [sellerId, cardNumber, price] of [['iris',12,9],['iris',17,42],['iris',22,180],['noam',26,8],['noam',31,11],['noam',36,21]] as const) {
        const cardId = `card-${cardNumber}`;
        const inv = db.prepare('SELECT quantity FROM inventory WHERE user_id=? AND card_id=?').get(sellerId,cardId);
        if (inv && Number(inv.quantity)>0) {
          db.prepare('UPDATE inventory SET quantity=quantity-1 WHERE user_id=? AND card_id=?').run(sellerId,cardId);
          db.prepare('INSERT INTO listings VALUES(?,?,?,?,?,\'active\',NULL,?,NULL)').run(id(),sellerId,cardId,1,price,date);
        }
      }
    }
    db.prepare("INSERT INTO settings VALUES('seed_version','1')").run();
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
