## **MarketPulse**

Real-time stock price and sentiment tracking dashboard powered by a streaming data pipeline.

[Live Demo](https://www.notion.so/your-vercel-url) · Python · FastAPI · Redis Streams · PostgreSQL · React

---

## Architecture

![Architecture Diagram](docs/diagram.png)

---

## Data Pipeline

- **Ingestion:** Two workers pull from external sources: `reddit_worker` queries several subreddits via the Arctic Shift API for posts referencing tracked tickers every 6 hours; `price_worker` polls the Finnhub API for price quotes every 5 minutes during market hours. Both parse relevant fields and publish JSON payloads to a Redis Stream hosted on Upstash.
- **Processing:** `price_consumer` reads from the prices stream and writes snapshots to PostgreSQL. `sentiment_consumer` reads from the sentiment stream, scores each post using VADER, and writes the result to PostgreSQL.
- **Storage:** Supabase-hosted PostgreSQL. Two core tables: `price_snapshots` and `sentiment_records`, both indexed on `(symbol, captured_at DESC)` for efficient time-series queries.
- **Serving:** FastAPI exposes REST endpoints for historical price and sentiment data, and a WebSocket endpoint for live price updates during market hours. All services in the ingestion and processing layers are deployed on Railway.
- **Frontend:** React/Vite app hosted on Vercel. Displays a dual-panel chart (price area chart + hourly sentiment bar chart) alongside stat cards and a live sentiment feed. Consumes the FastAPI REST and WebSocket endpoints.

---

## Technical Decisions

- **`statement_cache_size=0`**: asyncpg caches prepared statements by default, which conflicts with Supabase's pgBouncer connection pooler. Setting this to 0 disables that cache and prevents protocol-level errors on every query.
- **Direct connection (port 5432) over transaction pooler (6543)** — The transaction pooler resets session state between queries, which breaks asyncpg's connection lifecycle assumptions. Direct connection avoids this entirely.
- **`created_utc` for sentiment timestamps:** Reddit posts are ingested in batches, sometimes hours after they were written. Using the post's original creation time preserves accurate temporal context for sentiment analysis rather than reflecting when the pipeline happened to process it.
- **Two stacked charts:** Price data is captured every 5 minutes; sentiment is aggregated into hourly buckets. Sharing an x-axis would either compress price resolution or misrepresent sentiment granularity. Two independent charts preserve the integrity of both.
- **XAUTOCLAIM on startup:** When a consumer crashes mid-processing, messages remain in the Pending Entries List (PEL)**:** acknowledged as delivered but never confirmed complete. On startup, XAUTOCLAIM reclaims those stuck messages and reprocesses them, preventing silent data loss.
- **MAXLEN as stream TTL:** Redis Streams grow unbounded by default. MAXLEN caps stream size at ingestion time, keeping memory usage predictable without requiring a separate cleanup process.

---

## API Reference

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/tickers` | Returns all tracked tickers |
| GET | `/tickers/{symbol}/prices` | Returns price snapshots for a ticker |
| GET | `/tickers/{symbol}/sentiment` | Returns hourly sentiment scores for a ticker |
| GET | `/tickers/{symbol}/summary` | Returns latest price and aggregate sentiment |
| WS | `/ws/{symbol}` | Live price updates for a ticker |

---

## Local Setup

**Prerequisites:** Python 3.13, Node 22, Docker Desktop (for local development)

**External services required:** Upstash (Redis), Supabase (PostgreSQL), Finnhub API key

**Environment variables:**

`POSTGRES_URL=
REDIS_URL=
FINNHUB_API_KEY=
GITHUB_TOKEN=
UPSTASH_REDIS_REST_URL=
SUPABASE_POSTGRES_REST_URL=`

bash

`docker compose up        # starts local Postgres + Redis
python price_worker.py   # start ingestion
python reddit_worker.py
python price_consumer.py # start processing
python sentiment_consumer.py
uvicorn api.main:app     # start API
cd frontend && npm run dev`

---

## Roadmap

- **NewsAPI as institutional sentiment source** — Reddit reflects retail sentiment, while news outlets reflect institutional reaction. The divergence between these two signals is the interesting insight. I was inspired by the SMCI/NVIDIA GPU export story, in which Reddit largely called it an overreaction, yet institutional coverage was notably more doomer. Overlaying both signals on the same chart would make that dichotomy visible.
- StatCards — sentiment trend direction, post volume indicators