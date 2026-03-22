import { useState, useEffect } from "react";
import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000";

function getLastMarketDay() {
  const now = new Date();
  const day = now.getDay();
  const daysBack = day === 0 ? 2 : day === 6 ? 1 : 0;
  const marketDay = new Date(now);
  marketDay.setDate(now.getDate() - daysBack);

  const open = new Date(marketDay);
  open.setHours(9, 30, 0, 0);

  const close = new Date(marketDay);
  close.setHours(16, 0, 0, 0);

  return { open, close };
}

export function useSentimentData(symbol) {
  const [sentiment, setSentiment] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);

    const { open, close } = getLastMarketDay();

    // First try market hours window
    axios.get(`${BASE_URL}/tickers/${symbol}/sentiment`, {
      params: { limit: 48, from: open.toISOString(), to: close.toISOString() }
    })
    .then(res => {
      if (res.data.length > 0) {
        setSentiment([...res.data].reverse());
      } else {
        // No data for market window — fall back to latest 48 records
        console.log(`[${symbol}] No market hours sentiment, falling back to latest records`);
        return axios.get(`${BASE_URL}/tickers/${symbol}/sentiment`, {
          params: { limit: 48 }
        }).then(fallback => setSentiment([...fallback.data].reverse()));
      }
    })
    .catch(err => console.error("Sentiment fetch error:", err))
    .finally(() => setLoading(false));

  }, [symbol]);

  return { sentiment, loading };
}