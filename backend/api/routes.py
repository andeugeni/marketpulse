from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect, Query
from api.models import TickerResponse, PriceResponse, SentimentResponse, SummaryResponse, PostResponse
import asyncio
from datetime import datetime, timezone
from typing import Optional

# Design decision: APIRouter instead of registering routes
# directly on the app object. This means routes.py has zero
# knowledge of the app instance — it just defines endpoints.
# main.py owns the app and includes the router, keeping
# responsibilities clearly separated.
router = APIRouter()


def get_pool(request: Request):
    return request.app.state.pool


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/tickers", response_model=list[TickerResponse])
async def get_tickers(request: Request):
    pool = get_pool(request)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT symbol, name, created_at FROM tickers ORDER BY symbol"
        )
    return [dict(row) for row in rows]


@router.get("/tickers/{symbol}/prices", response_model=list[PriceResponse])
async def get_prices(
    symbol: str,
    request: Request,
    limit: int = 100,
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None),
):
    pool = get_pool(request)
    async with pool.acquire() as conn:
        ticker = await conn.fetchrow(
            "SELECT symbol FROM tickers WHERE symbol = $1",
            symbol.upper()
        )
        if not ticker:
            raise HTTPException(status_code=404, detail=f"Ticker {symbol} not found")

        rows = await conn.fetch(
            """
            SELECT symbol, price, volume, captured_at
            FROM price_snapshots
            WHERE symbol = $1
            AND ($2::timestamptz IS NULL OR captured_at >= $2)
            AND ($3::timestamptz IS NULL OR captured_at <= $3)
            ORDER BY captured_at DESC
            LIMIT $4
            """,
            symbol.upper(),
            from_,   # pass datetime directly, not str(from_)
            to,      # pass datetime directly, not str(to)
            limit,
        )
    return [dict(row) for row in rows]


@router.get("/tickers/{symbol}/sentiment", response_model=list[SentimentResponse])
async def get_sentiment(
    symbol: str,
    request: Request,
    limit: int = 48,
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None),
):
    pool = get_pool(request)
    async with pool.acquire() as conn:
        ticker = await conn.fetchrow(
            "SELECT symbol FROM tickers WHERE symbol = $1",
            symbol.upper()
        )
        if not ticker:
            raise HTTPException(status_code=404, detail=f"Ticker {symbol} not found")

        rows = await conn.fetch(
            """
            SELECT
                symbol,
                DATE_TRUNC('hour', captured_at) AS hour,
                AVG(score)::NUMERIC(5,4)         AS avg_score,
                COUNT(*)                         AS post_count
            FROM sentiment_records
            WHERE symbol = $1
            AND (($2::timestamptz IS NULL) OR captured_at >= $2::timestamptz)
            AND (($3::timestamptz IS NULL) OR captured_at <= $3::timestamptz)
            GROUP BY symbol, DATE_TRUNC('hour', captured_at)
            ORDER BY hour DESC
            LIMIT $4
            """,
            symbol.upper(),
            from_,   # pass datetime directly, not str(from_)
            to,      # pass datetime directly, not str(to)
            limit,
        )
    return [dict(row) for row in rows]


@router.get("/tickers/{symbol}/summary", response_model=SummaryResponse)
async def get_summary(symbol: str, request: Request):
    pool = get_pool(request)
    async with pool.acquire() as conn:
        ticker = await conn.fetchrow(
            "SELECT symbol FROM tickers WHERE symbol = $1", symbol.upper()
        )
        if not ticker:
            raise HTTPException(status_code=404, detail=f"Ticker {symbol} not found")

        latest_price = await conn.fetchrow(
            """
            SELECT price, captured_at
            FROM price_snapshots
            WHERE symbol = $1
            ORDER BY captured_at DESC
            LIMIT 1
            """,
            symbol.upper(),
        )

        if not latest_price:
            raise HTTPException(
                status_code=404, detail=f"No price data found for {symbol}"
            )

        sentiment = await conn.fetchrow(
            """
            SELECT
                AVG(score)::NUMERIC(5,4) AS avg_sentiment,
                COUNT(*)                 AS post_count
            FROM sentiment_records
            WHERE symbol = $1
              AND captured_at > NOW() - INTERVAL '24 hours'
            """,
            symbol.upper(),
        )

    return {
        "symbol": symbol.upper(),
        "latest_price": latest_price["price"],
        "price_captured_at": latest_price["captured_at"],
        "avg_sentiment": sentiment["avg_sentiment"] or 0.0,
        "sentiment_post_count": sentiment["post_count"] or 0,
    }

def is_market_hours() -> bool:
    now = datetime.now(timezone.utc)
    et_hour = (now.hour - 4) % 24
    et_minute = now.minute
    weekday = now.weekday()
    if weekday >= 5:
        return False
    market_open = et_hour > 9 or (et_hour == 9 and et_minute >= 30)
    market_close = et_hour < 16
    return market_open and market_close

@router.websocket("/ws/{symbol}")
async def websocket_endpoint(websocket: WebSocket, symbol: str):
    await websocket.accept()
    pool = websocket.app.state.pool
    
    if not is_market_hours():
        await websocket.send_json({"type": "closed", "message": "Market is closed"})
        await websocket.close()
        return

    symbol = symbol.upper()

    # Track the last seen ID for both tables
    # We use BIGSERIAL primary keys as cursors — more reliable than timestamps
    async with pool.acquire() as conn:
        last_price = await conn.fetchrow(
            "SELECT id FROM price_snapshots WHERE symbol = $1 ORDER BY id DESC LIMIT 1",
            symbol
        )
        last_sentiment = await conn.fetchrow(
            "SELECT id FROM sentiment_records WHERE symbol = $1 ORDER BY id DESC LIMIT 1",
            symbol
        )

    last_price_id = last_price["id"] if last_price else 0
    last_sentiment_id = last_sentiment["id"] if last_sentiment else 0

    try:
        while True:
            async with pool.acquire() as conn:

                # Check for new price records
                new_prices = await conn.fetch(
                    """
                    SELECT id, symbol, price, volume, captured_at
                    FROM price_snapshots
                    WHERE symbol = $1 AND id > $2
                    ORDER BY id ASC
                    """,
                    symbol,
                    last_price_id,
                )

                # Check for new sentiment records
                new_sentiments = await conn.fetch(
                    """
                    SELECT id, symbol, score, post_id, captured_at
                    FROM sentiment_records
                    WHERE symbol = $1 AND id > $2
                    ORDER BY id ASC
                    """,
                    symbol,
                    last_sentiment_id,
                )

            # Push new prices to client
            for row in new_prices:
                await websocket.send_json({
                    "type": "price",
                    "data": {
                        "symbol": row["symbol"],
                        "price": float(row["price"]),
                        "volume": row["volume"],
                        "captured_at": row["captured_at"].isoformat(),
                    }
                })
                last_price_id = row["id"]

            # Push new sentiments to client
            for row in new_sentiments:
                await websocket.send_json({
                    "type": "sentiment",
                    "data": {
                        "symbol": row["symbol"],
                        "score": float(row["score"]),
                        "post_id": row["post_id"],
                        "captured_at": row["captured_at"].isoformat(),
                    }
                })
                last_sentiment_id = row["id"]

            await asyncio.sleep(60)

    except WebSocketDisconnect:
        print(f"[{symbol}] WebSocket client disconnected")

@router.get("/tickers/{symbol}/posts", response_model=list[PostResponse])
async def get_posts(symbol: str, request: Request, limit: int = 20):
    pool = get_pool(request)
    async with pool.acquire() as conn:
        ticker = await conn.fetchrow(
            "SELECT symbol FROM tickers WHERE symbol = $1",
            symbol.upper()
        )
        if not ticker:
            raise HTTPException(status_code=404, detail=f"Ticker {symbol} not found")

        rows = await conn.fetch(
            """
            SELECT id, symbol, source, title, body, score, link, post_id, captured_at
            FROM sentiment_records
            WHERE symbol = $1
            ORDER BY captured_at DESC
            LIMIT $2
            """,
            symbol.upper(),
            limit,
        )
    return [dict(row) for row in rows]