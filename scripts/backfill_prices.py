import asyncio
import asyncpg
import random
from datetime import datetime, timezone, timedelta

POSTGRES_URL = "postgresql://dev:devpass@127.0.0.1:5432/marketpulse"

TICKER_BASES = {
    "RDDT": 140,
    "RKLB": 67,
    "GOOG": 300,
    "SMCI": 35,
}

async def run():
    pool = await asyncpg.create_pool(POSTGRES_URL)
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    records = []
    for symbol, base_price in TICKER_BASES.items():
        price = base_price
        current = week_ago

        while current < now:
            if current.weekday() < 5:  # skip weekends
                change = (random.random() - 0.495) * price * 0.008
                price = round(max(price + change, 0.01), 4)
                volume = random.randint(50000, 2000000)
                records.append((symbol, price, volume, current))
            current += timedelta(minutes=60)

        print(f"[{symbol}] Generated {len([r for r in records if r[0] == symbol])} records")

    async with pool.acquire() as conn:
        await conn.executemany(
            """
            INSERT INTO price_snapshots (symbol, price, volume, captured_at)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT DO NOTHING
            """,
            records
        )

    print(f"Inserted {len(records)} total records")
    await pool.close()

if __name__ == "__main__":
    asyncio.run(run())