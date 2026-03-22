import { useState, useEffect } from "react";
import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000";

function getLastMarketDay() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  // If today is Saturday (6), go back 1 day to Friday
  // If today is Sunday (0), go back 2 days to Friday
  // Otherwise use today
  const daysBack = day === 0 ? 2 : day === 6 ? 1 : 0;
  const marketDay = new Date(now);
  marketDay.setDate(now.getDate() - daysBack);

  // Market open: 9:30 AM ET, Market close: 4:00 PM ET
  const open = new Date(marketDay);
  open.setHours(9, 30, 0, 0);

  const close = new Date(marketDay);
  close.setHours(16, 0, 0, 0);

  return { open, close };
}

export function usePriceData(symbol) {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const { open, close } = getLastMarketDay();

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    axios.get(`${BASE_URL}/tickers/${symbol}/prices`, {
      params: {
        limit: 500,
        from: open.toISOString(),
        to: close.toISOString(),
      }
    })
      .then(res => setPrices([...res.data].reverse()))
      .catch(err => console.error("Price fetch error:", err))
      .finally(() => setLoading(false));
  }, [symbol]);

  const appendPrice = (record) => {
    setPrices(prev => [...prev.slice(-499), record]);
  };

  return { prices, loading, appendPrice };
}