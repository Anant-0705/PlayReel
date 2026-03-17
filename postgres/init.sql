-- ============================================================
-- GameReel — PostgreSQL Initialization
-- Runs automatically on first `docker-compose up` via
-- the postgres image's /docker-entrypoint-initdb.d/ mechanism
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── users ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username        TEXT NOT NULL UNIQUE,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  avatar_url      TEXT,
  bio             TEXT,
  fcm_token       TEXT,          -- Firebase Cloud Messaging device token
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_username_trgm_idx ON users USING GIN (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

-- ── games ─────────────────────────────────────────────────────
CREATE TYPE game_status AS ENUM ('uploading', 'processing', 'ready', 'flagged', 'failed');
CREATE TYPE game_format AS ENUM ('unity', 'godot', 'html5', 'wasm');
CREATE TYPE game_genre  AS ENUM (
  'action', 'puzzle', 'platformer', 'rpg', 'shooter',
  'strategy', 'sports', 'horror', 'simulation', 'other'
);

CREATE TABLE IF NOT EXISTS games (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uploader_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  genre            game_genre NOT NULL DEFAULT 'other',
  description      TEXT NOT NULL DEFAULT '',
  wasm_url         TEXT,
  assets_url       TEXT,
  manifest_url     TEXT,
  thumbnail_url    TEXT,
  playstore_url    TEXT,
  status           game_status NOT NULL DEFAULT 'uploading',
  format           game_format,
  engine_version   TEXT,
  file_size_bytes  BIGINT NOT NULL DEFAULT 0,
  play_count       BIGINT NOT NULL DEFAULT 0,
  like_count       BIGINT NOT NULL DEFAULT 0,
  comment_count    BIGINT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS games_uploader_id_idx  ON games (uploader_id);
CREATE INDEX IF NOT EXISTS games_status_idx        ON games (status);
CREATE INDEX IF NOT EXISTS games_genre_idx         ON games (genre);
CREATE INDEX IF NOT EXISTS games_created_at_idx    ON games (created_at DESC);
CREATE INDEX IF NOT EXISTS games_title_trgm_idx    ON games USING GIN (title gin_trgm_ops);

-- ── likes ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS likes (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id    UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS likes_game_id_idx ON likes (game_id);

-- ── comments ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id    UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  content    TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comments_game_id_idx     ON comments (game_id, created_at DESC);
CREATE INDEX IF NOT EXISTS comments_user_id_idx     ON comments (user_id);

-- ── follows ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follows (
  follower_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS follows_following_id_idx ON follows (following_id);

-- ── user_game_interactions ────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_game_interactions (
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id          UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  play_duration_s  INTEGER NOT NULL DEFAULT 0,
  completed        BOOLEAN NOT NULL DEFAULT FALSE,
  last_played_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS interactions_game_id_idx ON user_game_interactions (game_id);

-- ── upload_sessions ───────────────────────────────────────────
CREATE TYPE upload_status AS ENUM ('initiated', 'uploading', 'assembling', 'complete', 'failed');

CREATE TABLE IF NOT EXISTS upload_sessions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id          UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  uploader_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename         TEXT NOT NULL,
  total_size       BIGINT NOT NULL,
  total_chunks     INTEGER NOT NULL,
  chunks_received  INTEGER NOT NULL DEFAULT 0,
  status           upload_status NOT NULL DEFAULT 'initiated',
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS upload_sessions_uploader_id_idx ON upload_sessions (uploader_id, created_at DESC);
CREATE INDEX IF NOT EXISTS upload_sessions_game_id_idx     ON upload_sessions (game_id);

-- ── game_scan_results ─────────────────────────────────────────
CREATE TYPE risk_level AS ENUM ('none', 'warning', 'critical');

CREATE TABLE IF NOT EXISTS game_scan_results (
  game_id     UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
  risk_level  risk_level NOT NULL DEFAULT 'none',
  flags       JSONB NOT NULL DEFAULT '[]',
  scanned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Triggers: auto-update updated_at ─────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER upload_sessions_updated_at
  BEFORE UPDATE ON upload_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Triggers: maintain like_count / comment_count on games ────
CREATE OR REPLACE FUNCTION increment_like_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE games SET like_count = like_count + 1 WHERE id = NEW.game_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_like_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE games SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.game_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER likes_insert_trigger
  AFTER INSERT ON likes
  FOR EACH ROW EXECUTE FUNCTION increment_like_count();

CREATE TRIGGER likes_delete_trigger
  AFTER DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION decrement_like_count();

CREATE OR REPLACE FUNCTION increment_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE games SET comment_count = comment_count + 1 WHERE id = NEW.game_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE games SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.game_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comments_insert_trigger
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION increment_comment_count();

CREATE TRIGGER comments_delete_trigger
  AFTER DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION decrement_comment_count();

-- ── Seed data (development only) ─────────────────────────────
-- Uncomment to add a test admin user (password: 'devpassword')
-- INSERT INTO users (username, email, password_hash)
-- VALUES ('admin', 'admin@gamereel.dev', '$2b$12$...')
-- ON CONFLICT DO NOTHING;

-- ── Phase 3 additions ─────────────────────────────────────────

-- Add 'rejected' to game_status (game-processor uses it)
ALTER TYPE game_status ADD VALUE IF NOT EXISTS 'rejected';

-- Add scan warnings column to games (game-processor async scan)
ALTER TABLE games ADD COLUMN IF NOT EXISTS scan_warnings JSONB DEFAULT '[]';

-- ── device_tokens ──────────────────────────────────────────────
-- Stores FCM push tokens per device. One user can have multiple devices.
CREATE TABLE IF NOT EXISTS device_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  platform    TEXT NOT NULL DEFAULT 'fcm',
  device_name TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS device_tokens_user_id_idx ON device_tokens (user_id);

CREATE TRIGGER device_tokens_updated_at
  BEFORE UPDATE ON device_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

