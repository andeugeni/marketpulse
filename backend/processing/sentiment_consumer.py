import asyncio
import json
import os
from datetime import datetime

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import asyncpg
import redis.asyncio as aioredis
from dotenv import load_dotenv

load_dotenv()


REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
POSTGRES_URL = os.getenv("POSTGRES_URL")
STREAM_NAME = "marketpulse:reddit_sentiment"
GROUP_NAME = "reddit_sentiment-processors"
CONSUMER_NAME = "consumer-1"

analyzer = SentimentIntensityAnalyzer()

print(f"REDIS_URL loaded as: {REDIS_URL}")

async def ensure_consumer_group(redis):

    try:
        await redis.xgroup_create(STREAM_NAME, GROUP_NAME, id="0", mkstream=True)
        print(f"Consumer group '{STREAM_NAME}' created")
    except Exception as e:
        if "BUSYGROUP" in str(e):
            print(f"Consuemr group '{STREAM_NAME}' already exists")
        else:
            raise

'''
    id           BIGSERIAL PRIMARY KEY,
    symbol       VARCHAR(10) REFERENCES tickers(symbol),
    source       VARCHAR(50),
    body         TEXT,
    score        NUMERIC(5, 4),
    captured_at  TIMESTAMPTZ NOT NULL
'''
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
            record["subreddit"],
            title,
            body,
            score,
            record["post_id"],
            str_to_datetime(record["captured_at"]),
            record["link"]
        )

def str_to_datetime(date_string: str):
    return datetime.fromisoformat(date_string)

async def run():
    redis = await aioredis.from_url(REDIS_URL)
    pool = await asyncpg.create_pool(POSTGRES_URL, statement_cache_size=0)

    await ensure_consumer_group(redis)

    print("Price consumer started. Awaiting messages")

    while True:
        messages = await redis.xreadgroup(
            groupname=GROUP_NAME,
            consumername=CONSUMER_NAME,
            streams={STREAM_NAME: ">"},
            count=10,
            block=2000,  # block for 2 seconds if stream is empty
        )

        if not messages:
            continue

        for stream, records in messages:
            for msg_id, fields in records:
                try:
                    record = json.loads(fields[b"data"])
                    await write_to_postgres(pool, record)
                    await redis.xack(STREAM_NAME, GROUP_NAME, msg_id)
                    print(f"[{record['symbol']}] Written to Postgres: ${record['title']}")
                except Exception as e:
                    print(f"Error processing message {msg_id}: {e}")

if __name__ == "__main__":
    asyncio.run(run())

