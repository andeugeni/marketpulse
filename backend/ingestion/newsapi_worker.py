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

API_KEY = os.getenv("NEWSAPI_KEY")
REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379")
STREAM_NAME = "marketpulse:newsapi_sentiment"
TICKERS = ['RDDT', 'RKLB', 'GOOG', 'SMCI']
POLL_INTERVAL_SECONDS = 21600


# def is_market_hours() -> bool:
#     """Returns True if current time is within US market hours Mon-Fri 9:30AM-4PM ET."""
#     now = datetime.now(timezone.utc)
#     # UTC offsets: ET is UTC-5 (EST) or UTC-4 (EDT)
#     # Use UTC-4 for EDT (most of the year)
#     et_hour = (now.hour - 4) % 24
#     et_minute = now.minute
#     weekday = now.weekday()  # 0=Mon, 6=Sun

#     # Skip weekends
#     if weekday >= 5:
#         return False

#     # Market open 9:30 AM ET, close 4:00 PM ET
#     market_open = et_hour > 9 or (et_hour == 9 and et_minute >= 30)
#     market_close = et_hour < 16
#     return market_open and market_close


print(f"REDIS_URL loaded as: {REDIS_URL}")


async def fetch_news(client: httpx.AsyncClient, symbol: str) -> dict | None:
    url = "https://newsapi.org/v2/everything"
    q = symbol

    params = {
        'q': q,
        'apiKey': API_KEY,
        'pageSize': 10,
        'language': 'en'
    }

    try:
        response = await client.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()['articles']

        records = []

        for post in data:
            try:
                records.append({
                    "symbol": symbol,
                    "title": post["title"],
                    "body": post.get("description") or post.get("title", ""),
                    "source": post['source']['name'],
                    "post_id": post['url'],
                    "captured_at": datetime.fromisoformat(
                        post["publishedAt"].replace("Z", "+00:00")
                        ).isoformat(),
                    "link": post['url'],
                })
            except Exception as e:
                print(f"[{symbol}] Error parsing post from NewsAPI: {e}")

        print(f"[{symbol}] NewsAPI — collected {len(records)} posts")
        return records

    except Exception as e:
        print(f"[{symbol}] Fetch error from NewsAPI: {e}")
        return []
    


async def run():
    redis = await aioredis.from_url(REDIS_URL)
    async with httpx.AsyncClient() as client:
        print(f"Reddit worker started. Polling every {POLL_INTERVAL_SECONDS}s")
        print(f"Looking at: NewsAPI")

        while True:

            # if not is_market_hours():
            #     now = datetime.now(timezone.utc)
            #     print(f"[{now.strftime('%H:%M UTC')}] Outside market hours — sleeping 15 minutes")
            #     await asyncio.sleep(900)  # check again in 15 minutes
            #     continue         

            all_records = []

            for symbol in TICKERS:
                posts = await fetch_news(client, symbol)
                all_records.extend(posts)

            published = 0
            for record in all_records:
                await redis.xadd(STREAM_NAME, {"data": json.dumps(record)}, maxlen=200, approximate=True)
                published += 1

            print(f"Published {published} total posts to stream")
            await asyncio.sleep(POLL_INTERVAL_SECONDS)



if __name__ == "__main__":
    asyncio.run(run())