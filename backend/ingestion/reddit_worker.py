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
TICKERS = ["RDDT", "RKLB"]
POLL_INTERVAL_SECONDS = 7200


print(f"REDIS_URL loaded as: {REDIS_URL}")


async def fetch_posts(client: httpx.AsyncClient, symbol: str) -> dict | None:

    # LIVE PRODUCTION CODE
    url = "https://arctic-shift.photon-reddit.com/api/posts/search"
    params = {
        "subreddit": "wallstreetbets",
        "title": symbol,
        "limit": 25,
        "after": "1day",
    }

    try:
        response = await client.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()['data']
        # quote = data.get("Global Quote", {})
        # if not quote:
        #     print(f"[{symbol}] Empty response — possibly rate limited")
        #     return None

        for post in data:
            try:
                return {
                    "symbol": symbol,
                    "title": post['title'],
                    "body": post['selftext'],
                    "subreddit": "wallstreetbets",
                    "post_id": post['id'],
                    "captured_at": datetime.now(timezone.utc).isoformat(),
                }
            except Exception as e:
                print(f"Error logging post: {post['title']}")

    except Exception as e:
        print(f"[{symbol}] Fetch error: {e}")
        return None


async def run():
    redis = await aioredis.from_url(REDIS_URL)
    async with httpx.AsyncClient() as client:
        print(f"Reddit worker started. Polling {TICKERS} every {POLL_INTERVAL_SECONDS}s")
        while True:
            for symbol in TICKERS:
                record = await fetch_posts(client, symbol)
                if record:
                    await redis.xadd(STREAM_NAME, {"data": json.dumps(record)})
                    print(f"[{symbol}] Published to stream: ${record['title']}")
                await asyncio.sleep(1)  # small delay between ticker requests
            await asyncio.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    asyncio.run(run())