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

API_KEY = os.getenv("FINNHUB_API_KEY")
REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379")
STREAM_NAME = "marketpulse:prices"
TICKERS = ["RDDT", "RKLB", "GOOG", "SMCI"]
POLL_INTERVAL_SECONDS = 240  # every 4 minutes instead of 60 seconds


def is_market_hours() -> bool:
    """Returns True if current time is within US market hours Mon-Fri 9:30AM-4PM ET."""
    now = datetime.now(timezone.utc)
    # UTC offsets: ET is UTC-5 (EST) or UTC-4 (EDT)
    # Use UTC-4 for EDT (most of the year)
    et_hour = (now.hour - 4) % 24
    et_minute = now.minute
    weekday = now.weekday()  # 0=Mon, 6=Sun

    # Skip weekends
    if weekday >= 5:
        return False

    # Market open 9:30 AM ET, close 4:00 PM ET
    market_open = et_hour > 9 or (et_hour == 9 and et_minute >= 30)
    market_close = et_hour < 16
    return market_open and market_close


print(f"REDIS_URL loaded as: {REDIS_URL}")


async def fetch_quote(client: httpx.AsyncClient, symbol: str) -> dict | None:
    url = "https://finnhub.io/api/v1/quote"
    params = {
        "symbol": symbol,
        "token": API_KEY,
    }
    try:
        response = await client.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        if not data.get("c") or data["c"] == 0:
            print(f"[{symbol}] Price is 0 — market closed or symbol not found")
            return None

        return {
            "symbol": symbol,
            "price": data["c"],
            "volume": data.get("v"),
            "captured_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        print(f"[{symbol}] Fetch error: {e}")
        return None


async def run():
    redis = await aioredis.from_url(REDIS_URL)
    async with httpx.AsyncClient() as client:
        print(f"Price worker started. Polling {TICKERS} every {POLL_INTERVAL_SECONDS}s during market hours only")
        while True:
            if not is_market_hours():
                now = datetime.now(timezone.utc)
                print(f"[{now.strftime('%H:%M UTC')}] Outside market hours — sleeping 15 minutes")
                await asyncio.sleep(900)  # check again in 15 minutes
                continue

            for symbol in TICKERS:
                record = await fetch_quote(client, symbol)
                if record:
                    await redis.xadd(STREAM_NAME, {"data": json.dumps(record)}, maxlen=500, approximate=True)
                    print(f"[{symbol}] Published to stream: ${record['price']}")
                await asyncio.sleep(1)

            await asyncio.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    asyncio.run(run())