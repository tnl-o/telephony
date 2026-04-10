import { useEffect, useState } from 'react';

export function useWebSocket() {
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/status`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      // Reconnect after 5 seconds
      setTimeout(() => {
        console.log('Attempting to reconnect...');
      }, 5000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'status_update' && data.user?.username != null) {
          setOnlineUsers((prev) => {
            const next = new Set(prev);
            if (data.user.online) next.add(data.user.username);
            else next.delete(data.user.username);
            return next;
          });
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  return { onlineUsers, isConnected };
}
