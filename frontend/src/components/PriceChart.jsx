import {
  ComposedChart, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend
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
        p.value !== null && (
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
        )
      ))}
    </div>
  );
};

export default function PriceChart({ prices, sentiment }) {

  // Build a unified time series keyed by hour
  // Each entry has a time label, price, and sentiment
  const timeMap = {};

  // Add prices first — bucket to nearest hour
  prices.forEach(p => {
    const d = new Date(p.captured_at);
    d.setMinutes(0, 0, 0);
    const key = d.toISOString();
    if (!timeMap[key]) timeMap[key] = { time: null, price: null, sentiment: null };
    timeMap[key].price = parseFloat(p.price);
    timeMap[key].time = d.toLocaleDateString([], { month: "short", day: "numeric" })
      + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  });

  // Merge sentiment into same keys
  sentiment.forEach(s => {
    const d = new Date(s.hour);
    d.setMinutes(0, 0, 0);
    const key = d.toISOString();
    if (!timeMap[key]) timeMap[key] = { time: null, price: null, sentiment: null };
    timeMap[key].sentiment = parseFloat(s.avg_score);
    if (!timeMap[key].time) {
      timeMap[key].time = d.toLocaleDateString([], { month: "short", day: "numeric" })
        + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  });

  // Sort by time and flatten to array
  const data = Object.entries(timeMap)
    .sort(([a], [b]) => new Date(a) - new Date(b))
    .map(([, v]) => v)
    .filter(v => v.time !== null);

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
          Price + Sentiment · 1 Day
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
              tick={{ fontSize: 9, fill: "#8b949e", fontFamily: "monospace" }}
              tickLine={false}
              axisLine={{ stroke: "#21262d" }}
              interval={Math.floor(data.length / 6)}
            />
            <YAxis
              yAxisId="price"
              orientation="left"
              tick={{ fontSize: 10, fill: "#388bfd", fontFamily: "monospace" }}
              tickLine={false}
              axisLine={{ stroke: "#21262d" }}
              tickFormatter={v => `$${Number(v).toFixed(2)}`}
              domain={["auto", "auto"]}
              width={72}
            />
            <YAxis
              yAxisId="sentiment"
              orientation="right"
              tick={{ fontSize: 10, fill: "#00e5a0", fontFamily: "monospace" }}
              tickLine={false}
              axisLine={{ stroke: "#21262d" }}
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
              opacity={0.15}
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
              type="linear"
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