// src/lib/notifications-bus.ts

type SSEClient = {
  id: string;
  send: (data: string) => void;
};

const clients: Record<string, SSEClient[]> = {};

export function addClient(key: string, send: (data: string) => void) {
  if (!clients[key]) clients[key] = [];
  clients[key].push({ id: key, send });
}

export function removeClient(key: string) {
  delete clients[key];
}

export function broadcastNotification(notification: any) {
  const userKeyPrefix = notification.userId;

  const keys = Object.keys(clients).filter((k) =>
    k.startsWith(`${userKeyPrefix}:`)
  );

  const data = `event: notification\ndata: ${JSON.stringify(notification)}\n\n`;

  for (const key of keys) {
    for (const c of clients[key]) {
      try {
        c.send(data);
      } catch {
        removeClient(key);
      }
    }
  }
}

