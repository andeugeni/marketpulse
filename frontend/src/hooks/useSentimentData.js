import { useState, useEffect } from "react";
import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000";

export function useSentimentData(symbol) {
  const [sentiment, setSentiment] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);

    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);

    axios.get(`${BASE_URL}/tickers/${symbol}/sentiment`, {
      params: {
        limit: 168,  // 24 hours * 7 days
        from: from.toISOString(),
        to: to.toISOString(),
      }
    })
    .then(res => {
      if (res.data.length > 0) {
        setSentiment([...res.data].reverse());
      } else {
        return axios.get(`${BASE_URL}/tickers/${symbol}/sentiment`, {
          params: { limit: 168 }
        }).then(fallback => setSentiment([...fallback.data].reverse()));
      }
    })
    .catch(err => console.error("Sentiment fetch error:", err))
    .finally(() => setLoading(false));

  }, [symbol]);

  return { sentiment, loading };
}