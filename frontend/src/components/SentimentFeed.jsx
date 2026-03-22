import { useState, useEffect } from "react";
import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000";

function ScoreBar({ score }) {
  const pct = ((score + 1) / 2) * 100;
  const color = score > 0.2 ? "#00e5a0" : score < -0.2 ? "#ff4d6d" : "#f0c040";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
      <div style={{
        flex: 1, height: 4,
        background: "#1e2433",
        borderRadius: 2,
        overflow: "hidden"
      }}>
        <div style={{
          width: `${pct}%`,
          height: "100%",
          background: color,
          borderRadius: 2,
          transition: "width 0.3s ease"
        }} />
      </div>
      <span style={{
        fontFamily: "monospace",
        fontSize: 12,
        color,
        minWidth: 52,
        textAlign: "right"
      }}>
        {score > 0 ? "+" : ""}{Number(score).toFixed(3)}
      </span>
    </div>
  );
}

export default function SentimentFeed({ symbol }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    axios.get(`${BASE_URL}/tickers/${symbol}/posts?limit=20`)
      .then(res => setPosts(res.data))
      .catch(err => console.error("Posts fetch error:", err))
      .finally(() => setLoading(false));
  }, [symbol]);

  return (
    <div style={{
      background: "#161b22",
      border: "1px solid #21262d",
      borderRadius: 8,
      padding: 24,
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20
      }}>
        <span style={{
          fontSize: 13,
          color: "#8b949e",
          textTransform: "uppercase",
          letterSpacing: "0.5px"
        }}>
          Sentiment Feed
        </span>
        <span style={{ fontSize: 11, color: "#8b949e" }}>r/wallstreetbets</span>
      </div>

      {loading ? (
        <div style={{ color: "#8b949e", fontSize: 14, textAlign: "center", padding: 24 }}>
          Loading posts...
        </div>
      ) : posts.length === 0 ? (
        <div style={{ color: "#8b949e", fontSize: 14, textAlign: "center", padding: 24 }}>
          No posts found for {symbol}
        </div>
      ) : (
        <div style={{ maxHeight: 520, overflowY: "auto" }}>
          {posts.map(post => (
            <div key={post.id} style={{
              borderBottom: "1px solid #21262d",
              padding: "16px 0",
            }}>

              {/* Top row — ticker + signal + time */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8
              }}>
                <span style={{
                  fontSize: 15,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 4,
                  background: "rgba(56,139,253,0.15)",
                  color: "#388bfd",
                  border: "1px solid rgba(56,139,253,0.3)",
                  letterSpacing: "0.5px"
                }}>
                  {post.symbol}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: post.score > 0.2 ? "#00e5a0" : post.score < -0.2 ? "#ff4d6d" : "#f0c040"
                  }}>
                    {post.score > 0.2 ? "▲ BULL" : post.score < -0.2 ? "▼ BEAR" : "◆ NEUTRAL"}
                  </span>
                  <span style={{ fontSize: 11, color: "#484f58" }}>
                    {new Date(post.captured_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                </div>
              </div>

              {/* Title — [TICKER] - [POST TITLE] */}
              <p style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#e6edf3",
                marginBottom: 6,
                lineHeight: 1.4,
                fontFamily: "sans-serif",
              }}>
                {post.title || "No title"}
              </p>

              {/* Post body */}
              <p style={{
                fontSize: 13,
                color: "#8b949e",
                lineHeight: 1.6,
                fontFamily: "sans-serif",
                margin: 0,
                display: "-webkit-box",
                WebkitLineClamp: 4,
                WebkitBoxOrient: "vertical",
                overflow: "hidden"
              }}>
                {post.body || "No body text — title only post."}
              </p>

              <ScoreBar score={post.score} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}