const TICKERS = ["RDDT", "RKLB", "GOOG", "SMCI"];

export default function TickerSelector({ active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {TICKERS.map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          style={{
            border: `1px solid ${active === t ? "#388bfd" : "#21262d"}`,
            color: active === t ? "#388bfd" : "#8b949e",
            padding: "6px 14px",
            borderRadius: 4,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 13,
            background: active === t ? "rgba(56,139,253,0.1)" : "none",
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}