import asyncio
import json
import os
from datetime import datetime, timezone

import httpx
import redis.asyncio as aioredis
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
STREAM_NAME = "marketpulse:prices"
TICKERS = ["RDDT", "RKLB"]
POLL_INTERVAL_SECONDS = 3600


print(f"REDIS_URL loaded as: {REDIS_URL}")


async def fetch_quote(client: httpx.AsyncClient, symbol: str) -> dict | None:
    # MOCK - DELETE WHEN LIVE
    return {
        "symbol": symbol,
        "price": 67.67,
        "volume": 416767,
        "captured_at": datetime.now(timezone.utc).isoformat()
    }

    # LIVE PRODUCTION CODE
    url = "https://www.alphavantage.co/query"
    params = {
        "function": "GLOBAL_QUOTE",
        "symbol": symbol,
        "apikey": API_KEY,
    }

    try:
        response = await client.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        quote = data.get("Global Quote", {})
        if not quote:
            print(f"[{symbol}] Empty response — possibly rate limited")
            return None
        return {
            "symbol": symbol,
            "price": quote.get("05. price"),
            "volume": quote.get("06. volume"),
            "captured_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        print(f"[{symbol}] Fetch error: {e}")
        return None


async def run():
    redis = await aioredis.from_url(REDIS_URL)
    async with httpx.AsyncClient() as client:
        print(f"Price worker started. Polling {TICKERS} every {POLL_INTERVAL_SECONDS}s")
        while True:
            for symbol in TICKERS:
                record = await fetch_quote(client, symbol)
                if record:
                    await redis.xadd(STREAM_NAME, {"data": json.dumps(record)})
                    print(f"[{symbol}] Published to stream: ${record['price']}")
                await asyncio.sleep(1)  # small delay between ticker requests
            await asyncio.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    asyncio.run(run())