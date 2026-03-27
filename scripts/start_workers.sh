#!/bin/bash

# MarketPulse — launch all workers in separate terminal windows
# Run from the root of the repo: bash scripts/start_workers.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"

open -a Terminal "$BACKEND" &
sleep 0.5

osascript <<EOF
tell application "Terminal"
    -- Window 1: FastAPI
    do script "cd '$BACKEND' && source .venv/bin/activate && uvicorn api.main:app --reload"
    
    -- Window 2: Price Worker
    do script "cd '$BACKEND' && source .venv/bin/activate && python3 -m ingestion.price_worker"
    
    -- Window 3: Price Consumer
    do script "cd '$BACKEND' && source .venv/bin/activate && python3 -m processing.price_consumer"
    
    -- Window 4: Ingestion Worker
    do script "cd '$BACKEND' && source .venv/bin/activate && python3 -m ingestion.ingestion_worker"
    
    -- Window 5: NewsAPI Consumer
    do script "cd '$BACKEND' && source .venv/bin/activate && python3 -m processing.combined_consumer"

    -- Window 6: Frontend
    do script "cd '$ROOT/frontend' && nvm use 22 && npm run dev"
end tell
EOF

echo "All workers launched."