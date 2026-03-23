import { useEffect, useRef } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://127.0.0.1:8000";

export function useWebSocket(symbol, { onPrice, onSentiment }) {
  const wsRef = useRef(null);

  useEffect(() => {
    if (!symbol) return;

    const ws = new WebSocket(`${WS_URL}/ws/${symbol}`);
    wsRef.current = ws;

    ws.onopen = () => console.log(`[${symbol}] WebSocket connected`);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "price" && onPrice) onPrice(msg.data);
      if (msg.type === "sentiment" && onSentiment) onSentiment(msg.data);
    };

    ws.onerror = (e) => console.error("WebSocket error:", e);
    ws.onclose = () => console.log(`[${symbol}] WebSocket disconnected`);

    return () => ws.close();
  }, [symbol]);
}