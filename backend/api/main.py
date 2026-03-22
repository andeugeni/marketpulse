from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncpg
import os
from api.routes import router

POSTGRES_URL = os.getenv("POSTGRES_URL")

print(f"POSTGRES_URL at startup: {POSTGRES_URL}")
print(f"ALL VARS: { {k: v for k, v in os.environ.items() if 'POSTGRES' in k or 'REDIS' in k or 'FINNHUB' in k} }")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.pool = await asyncpg.create_pool(POSTGRES_URL)
    print("Database pool created")
    yield
    await app.state.pool.close()
    print("Database pool closed")


app = FastAPI(title="MarketPulse API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)