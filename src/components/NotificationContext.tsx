"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useAuth } from "./auth/AuthContext";

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
  const { user } = useAuth();

  // ----------------------------
  // INITIAL FETCH FROM BACKEND
  // ----------------------------
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const fetchNotifications = async () => {
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const data = await res.json();
          if (data.notifications) {
            setNotifications(data.notifications);
          }
        }
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
      }
    };

    fetchNotifications();

    const playSound = () => {
      try {
        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3"); // Light ping sound
        audio.volume = 0.5;
        audio.play().catch(err => console.warn("Audio play blocked:", err));
      } catch (err) {
        console.warn("Notification sound failed:", err);
      }
    };

    // ----------------------------
    // REALTIME CONNECTION (SSE)
    // ----------------------------
    const connect = () => {
      if (esRef.current) esRef.current.close();

      const es = new EventSource("/api/notifications/stream");
      esRef.current = es;

      es.addEventListener("notification", (e) => {
        const notif = JSON.parse(e.data);

        setNotifications((prev) => {
          if (prev.some((item) => item.id === notif.id)) return prev;
          playSound();
          return [notif, ...prev];
        });
      });

      es.onerror = () => {
        es.close();
        setTimeout(connect, 3000); // Wait 3s before reconnecting
      };
    };

    connect();

    return () => {
      esRef.current?.close();
    };
  }, [user?.id]);

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

  const markAllAsRead = async () => {
    await fetch("/api/notifications/mark-all-read", { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
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
