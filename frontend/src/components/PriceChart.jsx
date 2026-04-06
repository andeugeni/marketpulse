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

// ── Iterates payload so both series render in the tooltip ──
const SentimentTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0d1117", border: "1px solid #30363d",
      borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#e6edf3"
    }}>
      <div style={{ color: "#8b949e", marginBottom: 6 }}>{label}</div>
      {payload.map((entry) => {
        if (entry.value == null) return null; // skip null series at this bucket
        const val = entry.value;
        return (
          <div key={entry.name} style={{ color: entry.color, marginBottom: 2 }}>
            {entry.name}: {val > 0 ? "+" : ""}{Number(val).toFixed(3)}
          </div>
        );
      })}
    </div>
  );
};

function toHourKey(isoString) {
  const d = new Date(isoString);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

// ── Merges two time-series arrays keyed by hour string.
//    Missing source at a bucket stays null — no bar renders. ──
function mergeSentiment(redditSentiment, newsSentiment) {
  const map = new Map();

  for (const s of redditSentiment) {
    const key = toHourKey(s.hour);
    map.set(key, {
      time: new Date(key).toLocaleString([], {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      }),
      hour: key,
      redditSentiment: parseFloat(s.avg_score),
      newsSentiment: null,
    });
  }

  for (const s of newsSentiment) {
    const key = toHourKey(s.hour);
    const existing = map.get(key);
    if (existing) {
      existing.newsSentiment = parseFloat(s.avg_score);
    } else {
      map.set(key, {
        time: new Date(key).toLocaleString([], {
          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        }),
        hour: key,
        redditSentiment: null,
        newsSentiment: parseFloat(s.avg_score),
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.hour.localeCompare(b.hour));
}

export default function PriceChart({ prices, redditSentiment, newsSentiment, days, onDaysChange}) {
  const priceData = prices.map(p => ({
    time: new Date(p.captured_at).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    price: parseFloat(p.price),
  }));

  // ── Merged, sorted, null-safe sentiment array ──
  const sentimentData = mergeSentiment(
    redditSentiment ?? [],
    newsSentiment ?? []
  );

  const hasSentiment = sentimentData.length > 0;
  const priceTickInterval = Math.max(3, Math.floor(priceData.length / 8));
  const sentimentTickInterval = Math.max(3, Math.floor(sentimentData.length / 6));

  const minPrice = Math.min(...priceData.map(p => p.price));
  const maxPrice = Math.max(...priceData.map(p => p.price));
  const pricePadding = (maxPrice - minPrice) * 0.1;

  return (
    <div style={{
      background: "#161b22", border: "1px solid #21262d",
      borderRadius: 8, padding: "20px 20px 12px", marginBottom: 24
    }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{
          fontSize: 13, color: "#8b949e",
          textTransform: "uppercase", letterSpacing: "0.5px"
        }}>
          Price + Sentiment
        </span>

        {/* Window toggle */}
        <div style={{
          display: "flex",
          border: "1px solid #30363d",
          borderRadius: 6,
          overflow: "hidden",
        }}>
          {[1, 2, 5].map(d => (
            <button
              key={d}
              onClick={() => onDaysChange(d)}
              style={{
                padding: "3px 10px",
                fontSize: 11,
                fontFamily: "monospace",
                background: days === d ? "#388bfd" : "transparent",
                color: days === d ? "#fff" : "#8b949e",
                border: "none",
                borderRight: d !== 5 ? "1px solid #30363d" : "none",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
            >
              {d}D
            </button>
          ))}
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
          {/* ── Price chart ── */}
          <div style={{ marginBottom: 2 }}>
            <div style={{ fontSize: 10, color: "#388bfd", marginBottom: 4, letterSpacing: "0.5px" }}>
              PRICE
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={priceData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
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
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ── Sentiment chart — overlaid reddit + news ── */}
          {hasSentiment && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: "#8b949e", marginBottom: 4, letterSpacing: "0.5px" }}>
                SENTIMENT
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <ComposedChart data={sentimentData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 9, fill: "#8b949e", fontFamily: "monospace" }}
                    tickLine={false}
                    axisLine={{ stroke: "#21262d" }}
                    interval={sentimentTickInterval}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "#8b949e", fontFamily: "monospace" }}
                    tickLine={false}
                    axisLine={false}
                    domain={[-1, 1]}
                    width={44}
                    ticks={[-1, -0.5, 0, 0.5, 1]}
                  />
                  <Tooltip content={<SentimentTooltip />} />
                  <ReferenceLine y={0} stroke="#30363d" strokeDasharray="4 4" />

                  {/* Bars overlap — reddit renders first, news on top.
                      barSize is fixed so they don't stretch on sparse data. */}
                  <Bar dataKey="redditSentiment" name="Reddit" fill="#ff8c42" opacity={0.25} maxBarSize={48} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="newsSentiment" name="News" fill="#ff6eb4" opacity={0.25} maxBarSize={48} radius={[3, 3, 0, 0]} />

                  {/* Lines sit on top of bars for readability */}
                  <Line type="monotone" dataKey="redditSentiment" name="Reddit" stroke="#ff8c42" strokeWidth={1.5} dot={false} connectNulls />
                  <Line type="monotone" dataKey="newsSentiment" name="News" stroke="#ff6eb4" strokeWidth={1.5} dot={false} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}