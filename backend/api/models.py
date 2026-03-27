from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class TickerResponse(BaseModel):
    symbol: str
    name: str
    created_at: datetime


class PriceResponse(BaseModel):
    symbol: str
    price: float
    volume: Optional[int]
    captured_at: datetime


class SentimentResponse(BaseModel):
    symbol: str
    hour: datetime
    avg_score: float
    post_count: int
    source: str


class SummaryResponse(BaseModel):
    symbol: str
    latest_price: float
    price_captured_at: datetime
    avg_sentiment: float
    sentiment_post_count: int

class PostResponse(BaseModel):
    id: int
    symbol: str
    source: str
    title: Optional[str]
    body: str
    link: Optional[str]
    score: float
    post_id: str
    captured_at: datetime