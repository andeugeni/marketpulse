import asyncio
import json
import os
from datetime import datetime

import asyncpg
import redis.asyncio as aioredis
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
POSTGRES_URL = os.getenv("POSTGRES_URL")
STREAM_NAME = "marketpulse:prices"
GROUP_NAME = "price-processors"
CONSUMER_NAME = "consumer-1"

print(f"REDIS_URL loaded as: {REDIS_URL}")

async def ensure_consumer_group(redis):

    try:
        await redis.xgroup_create(STREAM_NAME, GROUP_NAME, id="0", mkstream=True)
        print(f"Consuemr group '{STREAM_NAME}' created")
    except Exception as e:
        if "BUSYGROUP" in str(e):
            print(f"Consuemr group '{STREAM_NAME}' already exists")
        else:
            raise


async def write_to_postgres(pool, record: dict):
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO price_snapshots (symbol, price, volume, captured_at)
            VALUES ($1, $2, $3, $4::timestamptz)
            """,
            record["symbol"],
            float(record["price"]),
            int(record["volume"]) if record.get("volume") else None,
            str_to_datetime(record["captured_at"]),
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
            block=300000,  # block for a minute if stream is empty
        )

        # if not messages:
        #     await asyncio.sleep(3600)  # chill for an hour when nothing to process
        #     continue

        for stream, records in messages:
            for msg_id, fields in records:
                try:
                    record = json.loads(fields[b"data"])
                    await write_to_postgres(pool, record)
                    await redis.xack(STREAM_NAME, GROUP_NAME, msg_id)
                    print(f"[{record['symbol']}] Written to Postgres: ${record['price']}")
                except Exception as e:
                    print(f"Error processing message {msg_id}: {e}")

        if not messages:
            print(f"OOH I'M SLEEPY (10min)")
            await asyncio.sleep(600)  # chill for ten minutes when nothing to process
            continue

if __name__ == "__main__":
    asyncio.run(run())

