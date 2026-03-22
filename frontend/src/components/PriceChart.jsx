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

  // Build a time-keyed map of prices so we can align them
  // with sentiment hourly buckets on the same x-axis
  const priceMap = Object.fromEntries(
    prices.map(p => {
      const key = new Date(p.captured_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
      return [key, p.price];
    })
  );

  // Sentiment drives the x-axis since it's already bucketed hourly.
  // We look up the matching price for each hour bucket.
  // If no price exists for that hour, connectNulls on the Line
  // component bridges the gap visually.
  const chartData = sentiment.map(s => {
    const key = new Date(s.hour).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
    return {
      time: key,
      sentiment: parseFloat(s.avg_score),
      price: priceMap[key] ?? null,
    };
  });

  // Fallback — if no sentiment data yet, render price only
  const priceOnlyData = prices.map(p => ({
    time: new Date(p.captured_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    }),
    price: p.price,
    sentiment: null,
  }));

  const data = chartData.length > 0 ? chartData : priceOnlyData;

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
            <YAxis
              yAxisId="price"
              orientation="left"
              tick={{ fontSize: 10, fill: "#8b949e", fontFamily: "monospace" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `$${v}`}
              domain={["auto", "auto"]}
              width={60}
            />
            <YAxis
              yAxisId="sentiment"
              orientation="right"
              tick={{ fontSize: 10, fill: "#8b949e", fontFamily: "monospace" }}
              tickLine={false}
              axisLine={false}
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