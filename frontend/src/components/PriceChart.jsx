import {
  ComposedChart, AreaChart, Area, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

const PriceTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0d1117", border: "1px solid #30363d",
      borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#e6edf3"
    }}>
      <div style={{ color: "#8b949e", marginBottom: 4 }}>{label}</div>
      <div style={{ color: "#388bfd" }}>
        ${Number(payload[0]?.value).toFixed(2)}
      </div>
    </div>
  );
};

const SentimentTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  const color = val > 0.2 ? "#00e5a0" : val < -0.2 ? "#ff4d6d" : "#f0c040";
  return (
    <div style={{
      background: "#0d1117", border: "1px solid #30363d",
      borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#e6edf3"
    }}>
      <div style={{ color: "#8b949e", marginBottom: 4 }}>{label}</div>
      <div style={{ color }}>
        {val > 0 ? "+" : ""}{Number(val).toFixed(3)}
      </div>
    </div>
  );
};

export default function PriceChart({ prices, sentiment }) {

  // Price data — full resolution, every 30-60 seconds
  const priceData = prices.map(p => ({
    time: new Date(p.captured_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }),
    price: parseFloat(p.price),
  }));

  // Sentiment data — hourly buckets only
  const sentimentData = sentiment.map(s => ({
    time: new Date(s.hour).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    }),
    sentiment: parseFloat(s.avg_score),
    posts: s.post_count,
  }));

  // X axis tick interval for price — show ~8 labels regardless of data density
  const priceTickInterval = Math.max(1, Math.floor(priceData.length / 8));

  const minPrice = Math.min(...priceData.map(p => p.price));
  const maxPrice = Math.max(...priceData.map(p => p.price));
  const pricePadding = (maxPrice - minPrice) * 0.1;

  return (
    <div style={{
      background: "#161b22",
      border: "1px solid #21262d",
      borderRadius: 8,
      padding: "20px 20px 12px",
      marginBottom: 24
    }}>

      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16
      }}>
        <span style={{
          fontSize: 13, color: "#8b949e",
          textTransform: "uppercase", letterSpacing: "0.5px"
        }}>
          Price + Sentiment · 24h
        </span>
        <div style={{ display: "flex", gap: 16, fontSize: 11 }}>
          <span style={{ color: "#388bfd" }}>── Price</span>
          <span style={{ color: "#00e5a0" }}>▬ Sentiment</span>
        </div>
      </div>

      {priceData.length === 0 ? (
        <div style={{
          height: 300, display: "flex",
          alignItems: "center", justifyContent: "center",
          color: "#8b949e", fontSize: 13
        }}>
          Waiting for data...
        </div>
      ) : (
        <>
          {/* ── TOP: Price chart at full resolution ── */}
          <div style={{ marginBottom: 2 }}>
            <div style={{ fontSize: 10, color: "#388bfd", marginBottom: 4, letterSpacing: "0.5px" }}>
              PRICE
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart
                data={priceData}
                margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#388bfd" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#388bfd" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 9, fill: "#8b949e", fontFamily: "monospace" }}
                  tickLine={false}
                  axisLine={{ stroke: "#21262d" }}
                  interval={priceTickInterval}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#388bfd", fontFamily: "monospace" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `$${Number(v).toFixed(2)}`}
                  domain={[minPrice - pricePadding, maxPrice + pricePadding]}
                  width={72}
                />
                <Tooltip content={<PriceTooltip />} />
                <Area
                  type="linear"
                  dataKey="price"
                  stroke="#388bfd"
                  strokeWidth={1.5}
                  fill="url(#priceGradient)"
                  dot={false}
                  name="price"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ── BOTTOM: Sentiment chart at hourly buckets ── */}
          {sentimentData.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: "#00e5a0", marginBottom: 4, letterSpacing: "0.5px" }}>
                SENTIMENT
              </div>
              <ResponsiveContainer width="100%" height={100}>
                <ComposedChart
                  data={sentimentData}
                  margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 9, fill: "#8b949e", fontFamily: "monospace" }}
                    tickLine={false}
                    axisLine={{ stroke: "#21262d" }}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "#00e5a0", fontFamily: "monospace" }}
                    tickLine={false}
                    axisLine={false}
                    domain={[-1, 1]}
                    width={44}
                    ticks={[-1, -0.5, 0, 0.5, 1]}
                  />
                  <Tooltip content={<SentimentTooltip />} />
                  <ReferenceLine
                    y={0}
                    stroke="#30363d"
                    strokeDasharray="4 4"
                  />
                  <Bar
                    dataKey="sentiment"
                    radius={[3, 3, 0, 0]}
                    name="sentiment"
                    maxBarSize={48}
                    fill="#00e5a0"
                    opacity={0.3}
                  />
                  <Line
                    type="monotone"
                    dataKey="sentiment"
                    stroke="#00e5a0"
                    strokeWidth={1.5}
                    dot={false}
                    name="sentiment"
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}