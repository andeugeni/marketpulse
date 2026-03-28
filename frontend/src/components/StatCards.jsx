export default function StatCards({ prices, redditSentiment, newsSentiment }) {
  const latest = prices[prices.length - 1];
  const first = prices[0];

  const priceChange = latest && first ? latest.price - first.price : 0;
  const pricePct = first ? ((priceChange / first.price) * 100).toFixed(2) : "0.00";

  const calcAvg = (data) => data.length
    ? (data.reduce((s, d) => s + parseFloat(d.avg_score), 0) / data.length).toFixed(3)
    : null;

  const sentimentColor = (val) => val === null
    ? "#8b949e"
    : val > 0.1 ? "#00e5a0"
    : val < -0.1 ? "#ff4d6d"
    : "#f0c040";

  const formatSentiment = (val) => val === null
    ? "--"
    : val > 0 ? `+${val}` : `${val}`;

  const redditAvg = calcAvg(redditSentiment);
  const newsAvg = calcAvg(newsSentiment);

  // Signal uses reddit as primary, falls back to news, then neutral
  const signalVal = redditAvg ?? newsAvg;
  const signal = signalVal === null ? "NEUTRAL"
    : signalVal > 0.1 ? "BULLISH"
    : signalVal < -0.1 ? "BEARISH"
    : "NEUTRAL";

  const cards = [
    {
      label: "Current Price",
      value: latest ? `$${latest.price.toFixed(2)}` : "--",
      color: "#e6edf3"
    },
    {
      label: "Session Change",
      value: `${priceChange >= 0 ? "+" : ""}${pricePct}%`,
      color: priceChange >= 0 ? "#00e5a0" : "#ff4d6d"
    },
    {
      label: "Reddit Sentiment",
      value: formatSentiment(redditAvg),
      color: sentimentColor(redditAvg)
    },
    {
      label: "News Sentiment",
      value: formatSentiment(newsAvg),
      color: sentimentColor(newsAvg)
    },
    {
      label: "Signal",
      value: signal,
      color: sentimentColor(signalVal)
    },
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      gap: 12,
      marginBottom: 24
    }}>
      {cards.map(card => (
        <div key={card.label} style={{
          background: "#161b22",
          border: "1px solid #21262d",
          borderRadius: 8,
          padding: "16px 20px"
        }}>
          <div style={{
            fontSize: 11,
            color: "#8b949e",
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: "0.5px"
          }}>
            {card.label}
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: card.color }}>
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}