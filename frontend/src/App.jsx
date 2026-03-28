import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import TickerSelector from "./components/TickerSelector";
import StatCards from "./components/StatCards";
import PriceChart from "./components/PriceChart";
import SentimentFeed from "./components/SentimentFeed";
import { useWebSocket } from "./hooks/useWebSocket";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function getLastTradingDay() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon ... 6=Sat

  // If weekend, roll back to Friday
  const daysBack = day === 0 ? 2 : day === 6 ? 1 : 0;
  const tradingDay = new Date(now);
  tradingDay.setDate(now.getDate() - daysBack);

  // Market open 9:30 AM ET, close 4:00 PM ET
  // We use local time here — acceptable for a resume project
  const from = new Date(tradingDay);
  from.setHours(6, 30, 0, 0);

  const to = new Date(tradingDay);
  to.setHours(13, 0, 0, 0);

  // If today is a weekday but before market open, use previous trading day
  if (daysBack === 0 && now < from) {
    const prevDay = now.getDay() === 1 ? 3 : 1; // Monday → Friday, else yesterday
    from.setDate(from.getDate() - prevDay);
    to.setDate(to.getDate() - prevDay);
  }

  // If today is a weekday and market is still open, use now as the end
  const marketOpen = daysBack === 0 && now >= from && now <= to;
  return { from, to: marketOpen ? now : to };
}

export default function App() {
  const [activeTicker, setActiveTicker] = useState("RDDT");
  const [prices, setPrices] = useState([]);
  const [sentiment, setSentiment] = useState([]);
  const [posts, setPosts] = useState([]);
  const [redditPosts, setRedditPosts] = useState([]);
  const [newsPosts, setNewsPosts] = useState([]);
  const [redditSentiment, setRedditSentiment] = useState([]);
  const [newsSentiment, setNewsSentiment] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeTicker) return;
    setLoading(true);

    const { from, to } = getLastTradingDay();

    const sentimentFrom = new Date();
    sentimentFrom.setHours(sentimentFrom.getHours() - 24);

    // Fire all three requests simultaneously — one Supabase wakeup instead of three
    Promise.all([
      axios.get(`${BASE_URL}/tickers/${activeTicker}/prices`, {
        params: { limit: 500, from: from.toISOString(), to: to.toISOString() }
      }),
      axios.get(`${BASE_URL}/tickers/${activeTicker}/sentiment`, {
        params: { limit: 100, from: sentimentFrom.toISOString(), to: new Date().toISOString() }
      }),
      axios.get(`${BASE_URL}/tickers/${activeTicker}/posts?limit=30`),
    ])
    .then(([pricesRes, sentimentRes, postsRes]) => {
      setPrices([...pricesRes.data].reverse());
      setSentiment([...sentimentRes.data].reverse());
      setRedditSentiment([...sentimentRes.data].reverse().filter(p => p.source !== "NewsAPI"));
      setNewsSentiment([...sentimentRes.data].reverse().filter(p => p.source === "NewsAPI"));
      setPosts(postsRes.data);
      setRedditPosts(postsRes.data.filter(p => p.source !== "NewsAPI"));
      setNewsPosts(postsRes.data.filter(p => p.source === "NewsAPI"));
    })
    .catch(err => console.error("Data fetch error:", err))
    .finally(() => setLoading(false));

  }, [activeTicker]);

  const appendPrice = (record) => {
    setPrices(prev => [...prev.slice(-499), record]);
  };

  const handlePrice = useCallback((record) => appendPrice(record), [appendPrice]);

  useWebSocket(activeTicker, {
    onPrice: handlePrice,
    onSentiment: () => {},
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", color: "#e6edf3" }}>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #21262d",
        padding: "16px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        background: "#0d1117",
        zIndex: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00e5a0" }} />
          <span style={{ fontSize: 18, fontWeight: 600 }}>MarketPulse</span>
          <span style={{
            fontSize: 11, color: "#3fb950",
            background: "rgba(63,185,80,0.1)",
            border: "1px solid rgba(63,185,80,0.3)",
            padding: "2px 8px", borderRadius: 3
          }}>LIVE</span>
        </div>
        <TickerSelector active={activeTicker} onChange={setActiveTicker} />
        <div style={{ fontSize: 12, color: "#8b949e" }}>
          {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Main content */}
      <div style={{ padding: "24px 32px" }}>

        {/* Ticker title */}
        <div style={{ marginBottom: 24 }}>
          <span style={{ fontSize: 28, fontWeight: 600 }}>{activeTicker}</span>
          <span style={{ fontSize: 14, color: "#8b949e", marginLeft: 12 }}>
            {prices.length > 0 ? `$${prices[prices.length - 1]?.price?.toFixed(2)}` : "--"}
          </span>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Stat cards skeleton */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{
                  background: "#161b22",
                  border: "1px solid #21262d",
                  borderRadius: 8,
                  padding: "16px 20px",
                  height: 80,
                  animation: "pulse 1.5s infinite",
                }} />
              ))}
            </div>
            {/* Chart skeleton */}
            <div style={{
              background: "#161b22",
              border: "1px solid #21262d",
              borderRadius: 8,
              height: 340,
              animation: "pulse 1.5s infinite",
            }} />
            {/* Feed skeleton */}
            <div style={{
              background: "#161b22",
              border: "1px solid #21262d",
              borderRadius: 8,
              height: 200,
              animation: "pulse 1.5s infinite",
            }} />
          </div>
        ) : (
          <>
            <StatCards prices={prices} sentiment={sentiment} />
            <PriceChart prices={prices} redditSentiment={redditSentiment} newsSentiment={newsSentiment}/>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, width: "100%" }}>
              <div style={{ minWidth: 0 }}>
                <SentimentFeed symbol={activeTicker} posts={redditPosts} />
              </div>
              <div style={{ minWidth: 0 }}>
                <SentimentFeed symbol={activeTicker} posts={newsPosts} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}