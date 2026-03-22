-- Tickers reference table
CREATE TABLE IF NOT EXISTS tickers (
    symbol      VARCHAR(10) PRIMARY KEY,
    name        TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Price data from Alpha Vantage
CREATE TABLE IF NOT EXISTS price_snapshots (
    id           BIGSERIAL PRIMARY KEY,
    symbol       VARCHAR(10) REFERENCES tickers(symbol),
    price        NUMERIC(12, 4) NOT NULL,
    volume       BIGINT,
    captured_at  TIMESTAMPTZ NOT NULL,
    source       VARCHAR(50) DEFAULT 'alpha_vantage'
);

-- Critical: every dashboard query filters by symbol + time
CREATE INDEX IF NOT EXISTS idx_price_symbol_time
    ON price_snapshots(symbol, captured_at DESC);

CREATE TABLE IF NOT EXISTS sentiment_records (
    id           BIGSERIAL PRIMARY KEY,
    post_id      VARCHAR(50),
    symbol       VARCHAR(10) REFERENCES tickers(symbol),
    source       VARCHAR(50),
    body         TEXT,
    score        NUMERIC(5, 4),
    captured_at  TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sentiment_post_id
    ON sentiment_records(post_id);

CREATE INDEX IF NOT EXISTS idx_sentiment_symbol_time
    ON sentiment_records(symbol, captured_at DESC);

ALTER TABLE sentiment_records ADD COLUMN IF NOT EXISTS title TEXT;