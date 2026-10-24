-- Mirror of the migration already applied to Supabase project fredou.
-- Private schema: no anon/authenticated grants or public API exposure.
CREATE SCHEMA IF NOT EXISTS fredou;
REVOKE ALL ON SCHEMA fredou FROM PUBLIC, anon, authenticated;
SET search_path TO fredou, public;

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
  
RESET search_path;
