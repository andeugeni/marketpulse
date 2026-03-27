import asyncio
import json
import os
from datetime import datetime, timezone

import httpx
import redis.asyncio as aioredis
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../.env")
if os.path.exists(env_path):
    load_dotenv(env_path)

REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379")
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY")
NEWSAPI_KEY = os.getenv("NEWSAPI_KEY")

TICKERS = ['RDDT', 'RKLB', 'GOOG', 'SMCI']

REDDIT_STREAM = "marketpulse:reddit_sentiment"
NEWSAPI_STREAM = "marketpulse:newsapi_sentiment"

REDDIT_POLL_INTERVAL = 300       # 5 minutes
NEWSAPI_POLL_INTERVAL = 21600    # 6 hours

print(f"REDIS_URL loaded as: {REDIS_URL}")


# ── Reddit ──────────────────────────────────────────────────────────────────

SUBREDDITS = {
    "RDDT": "redditstock",
    "RKLB": "RocketLab",
    "GOOG": "google",
    "SMCI": "supermicro",
}

async def fetch_reddit(client: httpx.AsyncClient, symbol: str) -> list:
    subreddit = SUBREDDITS.get(symbol, symbol.lower())
    url = f"https://arctic-shift.photon-reddit.com/api/posts/search"
    params = {
        "subreddit": subreddit,
        "limit": 10,
        "sort": "new",
    }
    try:
        response = await client.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json().get("data", [])

        records = []
        for post in data:
            try:
                records.append({
                    "symbol": symbol,
                    "title": post.get("title", ""),
                    "body": post.get("selftext", ""),
                    "source": subreddit,
                    "post_id": post["id"],
                    "captured_at": datetime.fromtimestamp(
                        int(post["created_utc"]), tz=timezone.utc
                    ).isoformat(),
                    "link": post.get("permalink", ""),
                })
            except Exception as e:
                print(f"[{symbol}] Error parsing Reddit post: {e}")

        print(f"[{symbol}] Reddit — collected {len(records)} posts")
        return records

    except Exception as e:
        print(f"[{symbol}] Reddit fetch error: {e}")
        return []


async def run_reddit(redis):
    async with httpx.AsyncClient() as client:
        print("Reddit ingestion started")
        while True:
            try:
                for symbol in TICKERS:
                    posts = await fetch_reddit(client, symbol)
                    for record in posts:
                        await redis.xadd(
                            REDDIT_STREAM,
                            {"data": json.dumps(record)},
                            maxlen=500,
                            approximate=True,
                        )
                print(f"[Reddit] Published batch to stream")
            except Exception as e:
                print(f"[Reddit] Worker error: {e}")
            await asyncio.sleep(REDDIT_POLL_INTERVAL)


# ── NewsAPI ──────────────────────────────────────────────────────────────────

async def fetch_news(client: httpx.AsyncClient, symbol: str) -> list:
    url = "https://newsapi.org/v2/everything"
    params = {
        "q": symbol,
        "apiKey": NEWSAPI_KEY,
        "pageSize": 10,
        "language": "en",
    }
    try:
        response = await client.get(url, params=params, timeout=10)
        response.raise_for_status()
        articles = response.json().get("articles", [])

        records = []
        for post in articles:
            try:
                records.append({
                    "symbol": symbol,
                    "title": post.get("title", ""),
                    "body": post.get("description") or post.get("title", ""),
                    "source": "NewsAPI",
                    "post_id": post["url"],
                    "captured_at": datetime.fromisoformat(
                        post["publishedAt"].replace("Z", "+00:00")
                    ).isoformat(),
                    "link": post["url"],
                })
            except Exception as e:
                print(f"[{symbol}] Error parsing NewsAPI article: {e}")

        print(f"[{symbol}] NewsAPI — collected {len(records)} articles")
        return records

    except Exception as e:
        print(f"[{symbol}] NewsAPI fetch error: {e}")
        return []


async def run_newsapi(redis):
    async with httpx.AsyncClient() as client:
        print("NewsAPI ingestion started")
        while True:
            try:
                for symbol in TICKERS:
                    articles = await fetch_news(client, symbol)
                    for record in articles:
                        await redis.xadd(
                            NEWSAPI_STREAM,
                            {"data": json.dumps(record)},
                            maxlen=200,
                            approximate=True,
                        )
                print(f"[NewsAPI] Published batch to stream")
            except Exception as e:
                print(f"[NewsAPI] Worker error: {e}")
            await asyncio.sleep(NEWSAPI_POLL_INTERVAL)


# ── Entrypoint ───────────────────────────────────────────────────────────────

async def run():
    redis = await aioredis.from_url(REDIS_URL)
    print("Ingestion worker started — running Reddit + NewsAPI concurrently")
    await asyncio.gather(
        run_reddit(redis),
        run_newsapi(redis),
    )


if __name__ == "__main__":
    asyncio.run(run())