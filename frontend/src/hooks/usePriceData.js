import { useState, useEffect } from "react";
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export function usePriceData(symbol) {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);

    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);

    axios.get(`${BASE_URL}/tickers/${symbol}/prices`, {
      params: {
        limit: 500,
        from: from.toISOString(),
        to: to.toISOString(),
      }
    })
    .then(res => {
      if (res.data.length > 0) {
        setPrices([...res.data].reverse());
      } else {
        return axios.get(`${BASE_URL}/tickers/${symbol}/prices`, {
          params: { limit: 200 }
        }).then(fallback => setPrices([...fallback.data].reverse()));
      }
    })
    .catch(err => console.error("Price fetch error:", err))
    .finally(() => setLoading(false));

  }, [symbol]);

  const appendPrice = (record) => {
    setPrices(prev => [...prev.slice(-499), record]);
  };

  return { prices, loading, appendPrice };
}