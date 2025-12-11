'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.user?.id) {
          const socketInstance = io({
            auth: { userId: data.user.id }
          });

          socketInstance.on('connect', () => {
            console.log('✅ Connected');
            setIsConnected(true);
          });

          socketInstance.on('notification', (notification) => {
            console.log('🔔 New notification:', notification);
          });

          setSocket(socketInstance);
        }
      });

    return () => {
      socket?.disconnect();
    };
  }, []);

  return { socket, isConnected };
}