import asyncio
import json
import os
from datetime import datetime

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import asyncpg
import redis.asyncio as aioredis
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../.env")
if os.path.exists(env_path):
    load_dotenv(env_path)

REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379")
POSTGRES_URL = os.getenv("POSTGRES_URL")

STREAMS = {
    "marketpulse:reddit_sentiment": "reddit-sentiment-processors",
    "marketpulse:newsapi_sentiment": "newsapi-sentiment-processors",
}
CONSUMER_NAME = "consumer-1"

analyzer = SentimentIntensityAnalyzer()

print(f"REDIS_URL loaded as: {REDIS_URL}")


async def ensure_consumer_groups(redis):
    for stream, group in STREAMS.items():
        try:
            await redis.xgroup_create(stream, group, id="0", mkstream=True)
            print(f"Consumer group '{group}' created on '{stream}'")
        except Exception as e:
            if "BUSYGROUP" in str(e):
                print(f"Consumer group '{group}' already exists")
            else:
                raise


async def drain_pending(redis):
    for stream, group in STREAMS.items():
        try:
            await redis.xautoclaim(
                stream, group, CONSUMER_NAME,
                min_idle_time=0, start_id="0-0", count=1000
            )
            print(f"Cleared pending backlog for '{stream}'")
        except Exception as e:
            print(f"XAUTOCLAIM error on '{stream}' (non-fatal): {e}")


async def write_to_postgres(pool, record: dict):
    title = record.get("title", "")
    body = record.get("body", "")
    text = title + " " + body
    score = analyzer.polarity_scores(text)["compound"]

    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO sentiment_records (symbol, source, title, body, score, post_id, captured_at, link)
            VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8)
            ON CONFLICT (post_id) DO NOTHING
            """,
            record["symbol"],
            record["source"],
            title,
            body,
            score,
            record["post_id"],
            datetime.fromisoformat(record["captured_at"]),
            record.get("link", ""),
        )


async def consume_stream(redis, pool, stream: str, group: str):
    print(f"Consuming '{stream}'")
    while True:
        try:
            messages = await redis.xreadgroup(
                groupname=group,
                consumername=CONSUMER_NAME,
                streams={stream: ">"},
                count=10,
                block=2000,
            )

            if not messages:
                await asyncio.sleep(60)
                continue

            for _, records in messages:
                for msg_id, fields in records:
                    try:
                        record = json.loads(fields[b"data"])
                        await write_to_postgres(pool, record)
                        await redis.xack(stream, group, msg_id)
                        print(f"[{record['symbol']}] [{stream}] Written: {record.get('title', '')[:60]}")
                    except Exception as e:
                        print(f"Error processing message {msg_id} on '{stream}': {e}")

        except Exception as e:
            print(f"Stream read error on '{stream}': {e}")
            await asyncio.sleep(5)


async def run():
    redis = await aioredis.from_url(REDIS_URL)

    pool = None
    for attempt in range(5):
        try:
            pool = await asyncpg.create_pool(
                POSTGRES_URL,
                statement_cache_size=0,
                timeout=30,
            )
            print("Database pool created")
            break
        except Exception as e:
            print(f"Pool creation attempt {attempt + 1} failed: {e}")
            await asyncio.sleep(5)

    if not pool:
        print("Failed to create database pool after 5 attempts — exiting")
        return

    await ensure_consumer_groups(redis)
    await drain_pending(redis)

    print("Sentiment consumer started — consuming Reddit + NewsAPI concurrently")

    await asyncio.gather(
        consume_stream(redis, pool, "marketpulse:reddit_sentiment", "reddit-sentiment-processors"),
        consume_stream(redis, pool, "marketpulse:newsapi_sentiment", "newsapi-sentiment-processors"),
    )


if __name__ == "__main__":
    asyncio.run(run())