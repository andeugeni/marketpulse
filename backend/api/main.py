from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncpg
import os
from dotenv import load_dotenv
from api.routes import router

load_dotenv()

POSTGRES_URL = os.getenv("POSTGRES_URL")

print(f"POSTGRES_URL at startup: {os.getenv('SUPABASE_POSTGRES_REST_URL')}")


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
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)