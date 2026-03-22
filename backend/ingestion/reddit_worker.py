import asyncio
import json
import os
from datetime import datetime, timezone

import httpx
import redis.asyncio as aioredis
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
STREAM_NAME = "marketpulse:reddit_sentiment"
TICKERS = ["RDDT", "RKLB", "GOOG", "SMCI"]
POLL_INTERVAL_SECONDS = 3600


print(f"REDIS_URL loaded as: {REDIS_URL}")


async def fetch_posts(client: httpx.AsyncClient, symbol: str) -> dict | None:

    # LIVE PRODUCTION CODE
    url = "https://arctic-shift.photon-reddit.com/api/posts/search"
    params = {
        "subreddit": "wallstreetbets",
        "selftext": symbol, 
        "limit": 25,
        "after": "7day",
    }

    try:
        response = await client.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json().get("data", []) or []

        records = []
        for post in data:
            try:
                record = {
                    "symbol": symbol,
                    "title": post["title"],
                    "body": post.get("selftext", ""),
                    "subreddit": "wallstreetbets",
                    "post_id": post["id"],
                    "captured_at": datetime.now(timezone.utc).isoformat(),
                }
                records.append(record)
                print(f"[{symbol}] Collected post: {post['title'][:60]}")
            except Exception as e:
                print(f"[{symbol}] Error parsing post: {e}")

        return records

    except Exception as e:
        print(f"[{symbol}] Fetch error: {e}")
        return []


async def run():
    redis = await aioredis.from_url(REDIS_URL)
    async with httpx.AsyncClient() as client:
        print(f"Reddit worker started. Polling {TICKERS} every {POLL_INTERVAL_SECONDS}s")
        while True:
            for symbol in TICKERS:
                print(f"[{symbol}] TICKER ---")
                posts = await fetch_posts(client, symbol)
                for post in posts:
                    await redis.xadd(STREAM_NAME, {"data": json.dumps(post)})
                print(f"[{symbol}] {len(posts)} posts published to stream")
                await asyncio.sleep(1)
            await asyncio.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    asyncio.run(run())