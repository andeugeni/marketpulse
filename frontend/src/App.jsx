import { useState } from "react";
import TickerSelector from "./components/TickerSelector";
import StatCards from "./components/StatCards";
import PriceChart from "./components/PriceChart";
import SentimentFeed from "./components/SentimentFeed";
import { usePriceData } from "./hooks/usePriceData";
import { useSentimentData } from "./hooks/useSentimentData";
import { useWebSocket } from "./hooks/useWebSocket";

export default function App() {
  const [activeTicker, setActiveTicker] = useState("RDDT");

  const { prices, appendPrice } = usePriceData(activeTicker);
  const { sentiment } = useSentimentData(activeTicker);

  // Wire WebSocket live updates into price state
  useWebSocket(activeTicker, {
    onPrice: (record) => appendPrice(record),
    onSentiment: () => {},  // sentiment feed coming soon
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", color: "#e6edf3" }}>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #21262d", padding: "16px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, background: "#0d1117", zIndex: 10
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

        <StatCards prices={prices} sentiment={sentiment} />
        <PriceChart prices={prices} sentiment={sentiment} />
        <SentimentFeed symbol={activeTicker} />

      </div>
    </div>
  );
}