import {
  ComposedChart, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0d1117",
      border: "1px solid #30363d",
      borderRadius: 8,
      padding: "10px 14px",
      fontSize: 12,
      color: "#e6edf3"
    }}>
      <div style={{ color: "#8b949e", marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{
          color: p.color,
          display: "flex",
          gap: 16,
          justifyContent: "space-between"
        }}>
          <span>{p.name}</span>
          <span>
            {p.name === "price"
              ? `$${Number(p.value).toFixed(2)}`
              : Number(p.value).toFixed(3)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function PriceChart({ prices, sentiment }) {

  // Bucket prices by hour to align with sentiment data
  const priceBuckets = {};
  prices.forEach(p => {
    const hour = new Date(p.captured_at);
    hour.setMinutes(0, 0, 0);
    const key = hour.toISOString();
    // Keep the last price in each hour bucket
    priceBuckets[key] = p.price;
  });

  // Build chart data from sentiment hours, merging in price
  const sentimentData = sentiment.map(s => {
    const hour = new Date(s.hour);
    hour.setMinutes(0, 0, 0);
    const key = hour.toISOString();
    return {
      time: new Date(s.hour).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      sentiment: parseFloat(s.avg_score),
      price: priceBuckets[key] ? parseFloat(priceBuckets[key]) : null,
    };
  });

  // Fallback — if no sentiment yet, render price only
  const priceOnlyData = prices.map(p => ({
    time: new Date(p.captured_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    price: parseFloat(p.price),
    sentiment: null,
  }));

  const data = sentimentData.length > 0 ? sentimentData : priceOnlyData;

  return (
    <div style={{
      background: "#161b22",
      border: "1px solid #21262d",
      borderRadius: 8,
      padding: "20px 20px 8px",
      marginBottom: 24
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16
      }}>
        <span style={{
          fontSize: 13,
          color: "#8b949e",
          textTransform: "uppercase",
          letterSpacing: "0.5px"
        }}>
          Price + Sentiment · Hourly
        </span>
        <div style={{ display: "flex", gap: 16, fontSize: 11 }}>
          <span style={{ color: "#388bfd" }}>── Price</span>
          <span style={{ color: "#00e5a0" }}>── Sentiment</span>
        </div>
      </div>

      {data.length === 0 ? (
        <div style={{
          height: 300,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#8b949e",
          fontSize: 13
        }}>
          Waiting for data...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: "#8b949e", fontFamily: "monospace" }}
              tickLine={false}
              axisLine={{ stroke: "#21262d" }}
              interval={3}
            />
            {/* Left axis — price */}
            <YAxis
              yAxisId="price"
              orientation="left"
              tick={{ fontSize: 10, fill: "#388bfd", fontFamily: "monospace" }}
              tickLine={false}
              axisLine={{ stroke: "#388bfd", strokeWidth: 1 }}
              tickFormatter={v => `$${Number(v).toFixed(2)}`}
              domain={["auto", "auto"]}
              width={70}
            />
            {/* Right axis — sentiment */}
            <YAxis
              yAxisId="sentiment"
              orientation="right"
              tick={{ fontSize: 10, fill: "#00e5a0", fontFamily: "monospace" }}
              tickLine={false}
              axisLine={{ stroke: "#00e5a0", strokeWidth: 1 }}
              domain={[-1, 1]}
              width={44}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              yAxisId="sentiment"
              y={0}
              stroke="#30363d"
              strokeDasharray="4 4"
            />
            <Bar
              yAxisId="sentiment"
              dataKey="sentiment"
              fill="#388bfd"
              opacity={0.18}
              radius={[1, 1, 0, 0]}
              name="sentiment"
            />
            <Line
              yAxisId="sentiment"
              type="monotone"
              dataKey="sentiment"
              stroke="#00e5a0"
              strokeWidth={1.5}
              dot={false}
              name="sentiment"
              connectNulls
            />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="price"
              stroke="#388bfd"
              strokeWidth={2}
              dot={false}
              name="price"
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}