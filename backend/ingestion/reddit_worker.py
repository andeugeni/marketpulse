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
STREAM_NAME = "marketpulse:reddit_sentiment"
POLL_INTERVAL_SECONDS = 3600

# General sentiment subreddits — search by ticker symbol
GENERAL_SUBREDDITS = ["wallstreetbets", "investing", "stocks", "thetagang", "ValueInvesting"]

# Company-specific subreddits — all posts are relevant, no title filter needed
TICKER_SUBREDDITS = {
    "RKLB": ["RKLB", "RKLBInvestors"],
    "RDDT": ["RDDT", "redditstock"],
    "SMCI": ["SMCIDiscussion"],
    "GOOG": ["GOOG_Stock"],
}

BASE_URL = "https://arctic-shift.photon-reddit.com/api/posts/search"


async def fetch_general_posts(
    client: httpx.AsyncClient,
    symbol: str,
    subreddit: str,
) -> list:
    """Search general subreddits for posts mentioning the ticker by title."""
    # params = {
    #     "subreddit": subreddit,
    #     "title": symbol,
    #     "limit": 25,
    #     "after": "1hour",
    # }
    params = {
        "subreddit": subreddit,
        "selftext": symbol, 
        "limit": 25,
        "after": "30day",
    }
    try:
        response = await client.get(BASE_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json().get("data", []) or []

        records = []
        for post in data:
            try:
                records.append({
                    "symbol": symbol,
                    "title": post["title"],
                    "body": post.get("selftext", ""),
                    "subreddit": subreddit,
                    "post_id": post["id"],
                    "captured_at": datetime.now(timezone.utc).isoformat(),
                })
            except Exception as e:
                print(f"[{symbol}] Error parsing post from r/{subreddit}: {e}")

        print(f"[{symbol}] r/{subreddit} — collected {len(records)} posts")
        return records

    except Exception as e:
        print(f"[{symbol}] Fetch error from r/{subreddit}: {e}")
        return []


async def fetch_ticker_subreddit_posts(
    client: httpx.AsyncClient,
    symbol: str,
    subreddit: str,
) -> list:
    """Fetch all recent posts from a company-specific subreddit — no title filter."""
    params = {
        "subreddit": subreddit,
        "limit": 25,
        "after": "30day",
    }
    try:
        response = await client.get(BASE_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json().get("data", []) or []

        records = []
        for post in data:
            try:
                records.append({
                    "symbol": symbol,
                    "title": post["title"],
                    "body": post.get("selftext", ""),
                    "subreddit": subreddit,
                    "post_id": post["id"],
                    "captured_at": datetime.fromtimestamp(
                        post["created_utc"], tz=timezone.utc
                    ).isoformat(),
                    "link": post['url']
                })
            except Exception as e:
                print(f"[{symbol}] Error parsing post from r/{subreddit}: {e}")

        print(f"[{symbol}] r/{subreddit} — collected {len(records)} posts")
        return records

    except Exception as e:
        print(f"[{symbol}] Fetch error from r/{subreddit}: {e}")
        return []


async def run():
    redis = await aioredis.from_url(REDIS_URL)

    async with httpx.AsyncClient() as client:
        print(f"Reddit worker started. Polling every {POLL_INTERVAL_SECONDS}s")
        print(f"General subreddits: {GENERAL_SUBREDDITS}")
        print(f"Ticker subreddits: {TICKER_SUBREDDITS}")

        while True:
            all_records = []

            # Poll general subreddits for each ticker by title
            for subreddit in GENERAL_SUBREDDITS:
                for symbol in TICKER_SUBREDDITS.keys():
                    posts = await fetch_general_posts(client, symbol, subreddit)
                    all_records.extend(posts)
                    await asyncio.sleep(1)  # avoid rate limiting

            # Poll company-specific subreddits
            for symbol, subreddits in TICKER_SUBREDDITS.items():
                for subreddit in subreddits:
                    posts = await fetch_ticker_subreddit_posts(client, symbol, subreddit)
                    all_records.extend(posts)
                    await asyncio.sleep(1)

            # Publish all collected posts to stream
            published = 0
            for record in all_records:
                await redis.xadd(STREAM_NAME, {"data": json.dumps(record)})
                published += 1

            print(f"Published {published} total posts to stream")
            await asyncio.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    asyncio.run(run())