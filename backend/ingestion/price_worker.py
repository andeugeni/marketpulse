import asyncio
import json
import os
from datetime import datetime, timezone

import httpx
import redis.asyncio as aioredis
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("FINNHUB_API_KEY")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
STREAM_NAME = "marketpulse:prices"
TICKERS = ["RDDT", "RKLB", "GOOG", "SMCI"]
POLL_INTERVAL_SECONDS = 300


print(f"REDIS_URL loaded as: {REDIS_URL}")


async def fetch_quote(client: httpx.AsyncClient, symbol: str) -> dict | None:
    # MOCK - DELETE WHEN LIVE
    # return {
    #     "symbol": symbol,
    #     "price": 67.67,
    #     "volume": 416767,
    #     "captured_at": datetime.now(timezone.utc).isoformat()
    # }

    # LIVE PRODUCTION CODE
    url = "https://finnhub.io/api/v1/quote"
    params = {
        "symbol": symbol,
        "token": API_KEY,
    }

    try:
        response = await client.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        print(f"[{symbol}] Raw response: {data}")

        # Finnhub returns all zeros when market is closed or symbol is invalid
        if not data.get("c") or data["c"] == 0:
            print(f"[{symbol}] Price is 0 — market likely closed or symbol not found")
            return None

        return {
            "symbol": symbol,
            "price": data["c"],       # current price
            "volume": data.get("v"),  # volume
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