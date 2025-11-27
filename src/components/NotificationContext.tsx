"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";

interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  createdAt?: string;
  read: boolean;
  payload?: any;
  link?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (n: Omit<Notification, "id" | "createdAt" | "read">) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx)
    throw new Error("useNotifications must be used inside NotificationProvider");
  return ctx;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const esRef = useRef<EventSource | null>(null);

  // ----------------------------
  // INITIAL FETCH FROM BACKEND
  // ----------------------------
  // useEffect(() => {
  //   fetch("/api/notifications")
  //     .then((res) => res.json())
  //     .then((data) => {
  //       if (data.notifications) {
  //         setNotifications(data.notifications);
  //       }
  //     });

  //   // ----------------------------
  //   // REALTIME CONNECTION (SSE)
  //   // ----------------------------
  //   const connect = () => {
  //     const es = new EventSource("/api/notifications/stream");
  //     esRef.current = es;

  //     es.addEventListener("notification", (e) => {
  //       const notif = JSON.parse(e.data);

  //       setNotifications((prev) => {
  //         if (prev.some((item) => item.id === notif.id)) return prev;
  //         return [notif, ...prev];
  //       });
  //     });

  //     es.onerror = () => {
  //       es.close();
  //       setTimeout(connect, 2000);
  //     };
  //   };

  //   connect();

  //   return () => {
  //     esRef.current?.close();
  //   };
  // }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // ----------------------------
  // CREATE NEW NOTIFICATION (UI)
  // ----------------------------
  const addNotification = async (
    n: Omit<Notification, "id" | "createdAt" | "read">
  ) => {
    await fetch("/api/notifications/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: n.type,
        title: n.title,
        body: n.body,
        payload: n.payload,
        channels: ["in-app"],
      }),
    });
  };

  // ----------------------------
  // MARK AS READ
  // ----------------------------
  const markAsRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    notifications.forEach((n) => markAsRead(n.id));
  };

  // ----------------------------
  // DELETE (LOCAL ONLY)
  // ----------------------------
  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
