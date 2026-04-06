import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import TickerSelector from "./components/TickerSelector";
import StatCards from "./components/StatCards";
import PriceChart from "./components/PriceChart";
import SentimentFeed from "./components/SentimentFeed";
import { useWebSocket } from "./hooks/useWebSocket";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function getLastNTradingDays(n) {
  const now = new Date();
  let daysFound = 0;
  let cursor = new Date(now);
  const dates = [];

  while (daysFound < n) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(new Date(cursor));
      daysFound++;
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  // earliest trading day in window
  const oldest = dates[dates.length - 1];
  const from = new Date(oldest);
  from.setHours(6, 30, 0, 0);

  return { from, to: now };
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
  const [days, setDays] = useState(1);

  useEffect(() => {
    if (!activeTicker) return;
    setLoading(true);

    const { from, to } = getLastNTradingDays(days);

    const sentimentFrom = new Date();
    sentimentFrom.setHours(sentimentFrom.getHours() - 48);

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
      setRedditSentiment([...sentimentRes.data].filter(p => p.source !== "NewsAPI"));
      const redditSentiment_ = [...sentimentRes.data].filter(p => p.source !== "NewsAPI")
      setNewsSentiment([...sentimentRes.data].filter(p => p.source === "NewsAPI"));
      const newsSentiment_ = [...sentimentRes.data].filter(p => p.source === "NewsAPI")
      // console.log("REDDIT SENTIMENT == ");
      // console.log(redditSentiment_);
      // console.log("NEWS SENTIMENT == ");
      // console.log(newsSentiment_);
      setPosts(postsRes.data);
      setRedditPosts(postsRes.data.filter(p => p.source !== "NewsAPI"));
      setNewsPosts(postsRes.data.filter(p => p.source === "NewsAPI"));
    })
    .catch(err => console.error("Data fetch error:", err))
    .finally(() => setLoading(false));

  }, [activeTicker, days]);

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
            <StatCards prices={prices} redditSentiment={redditSentiment} newsSentiment={newsSentiment}/>
            <PriceChart prices={prices} redditSentiment={redditSentiment} newsSentiment={newsSentiment} days={days} onDaysChange={setDays}/>
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