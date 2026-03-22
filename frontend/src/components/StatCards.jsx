export default function StatCards({ prices, sentiment }) {
  const latest = prices[prices.length - 1];
  const first = prices[0];

  const priceChange = latest && first ? latest.price - first.price : 0;
  const pricePct = first ? ((priceChange / first.price) * 100).toFixed(2) : "0.00";

  const avgSentiment = sentiment.length
    ? (sentiment.reduce((s, d) => s + d.avg_score, 0) / sentiment.length).toFixed(3)
    : "0.000";

  const sentColor = avgSentiment > 0.1
    ? "#00e5a0"
    : avgSentiment < -0.1
    ? "#ff4d6d"
    : "#f0c040";

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
      label: "Avg Sentiment",
      value: avgSentiment > 0 ? `+${avgSentiment}` : avgSentiment,
      color: sentColor
    },
    {
      label: "Signal",
      value: avgSentiment > 0.1 ? "BULLISH" : avgSentiment < -0.1 ? "BEARISH" : "NEUTRAL",
      color: sentColor
    },
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
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