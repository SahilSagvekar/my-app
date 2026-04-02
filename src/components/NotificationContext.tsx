"use client";

import {
  type Dispatch,
  type SetStateAction,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useAuth } from "./auth/AuthContext";
import { buildAuthenticatedFetchInit } from "@/lib/client-auth";

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

function applyNotification(notif: Notification, playSound: () => void, setNotifications: Dispatch<SetStateAction<Notification[]>>) {
  setNotifications((prev) => {
    if (prev.some((item) => item.id === notif.id)) {
      return prev;
    }

    playSound();
    return [notif, ...prev];
  });
}

function processSseChunk(
  chunk: string,
  playSound: () => void,
  setNotifications: Dispatch<SetStateAction<Notification[]>>,
) {
  let eventType = "message";
  const dataLines: string[] = [];

  for (const line of chunk.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("event:")) {
      eventType = line.slice("event:".length).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (eventType !== "notification" || dataLines.length === 0) {
    return;
  }

  try {
    const notif = JSON.parse(dataLines.join("\n")) as Notification;
    applyNotification(notif, playSound, setNotifications);
  } catch (error) {
    console.error("Failed to parse notification stream event:", error);
  }
}

async function consumeNotificationStream(
  signal: AbortSignal,
  playSound: () => void,
  setNotifications: Dispatch<SetStateAction<Notification[]>>,
) {
  const response = await fetch(
    "/api/notifications/stream",
    buildAuthenticatedFetchInit({
      cache: "no-store",
      signal,
    }),
  );

  if (!response.ok || !response.body) {
    throw new Error(`Notification stream request failed with status ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!signal.aborted) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      processSseChunk(chunk, playSound, setNotifications);
    }
  }
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx)
    throw new Error("useNotifications must be used inside NotificationProvider");
  return ctx;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const streamAbortRef = useRef<AbortController | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        const res = await fetch("/api/notifications", buildAuthenticatedFetchInit());
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
    const connect = async () => {
      streamAbortRef.current?.abort();

      const controller = new AbortController();
      streamAbortRef.current = controller;

      try {
        await consumeNotificationStream(controller.signal, playSound, setNotifications);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Notification stream disconnected:", error);
        }
      } finally {
        if (!controller.signal.aborted) {
          reconnectTimerRef.current = setTimeout(() => {
            void connect();
          }, 3000);
        }
      }
    };

    void connect();

    return () => {
      streamAbortRef.current?.abort();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [user?.id]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // ----------------------------
  // CREATE NEW NOTIFICATION (UI)
  // ----------------------------
  const addNotification = async (
    n: Omit<Notification, "id" | "createdAt" | "read">
  ) => {
    await fetch("/api/notifications/create", buildAuthenticatedFetchInit({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: n.type,
        title: n.title,
        body: n.body,
        payload: n.payload,
        channels: ["in-app"],
      }),
    }));
  };

  // ----------------------------
  // MARK AS READ
  // ----------------------------
  const markAsRead = async (id: string) => {
    await fetch(
      `/api/notifications/${id}/read`,
      buildAuthenticatedFetchInit({ method: "PATCH" }),
    );

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = async () => {
    await fetch(
      "/api/notifications/mark-all-read",
      buildAuthenticatedFetchInit({ method: "PATCH" }),
    );
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
