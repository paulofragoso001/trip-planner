"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  type: string | null;
  title: string | null;
  body: string | null;
  trip_id: string | null;
  trip_segment_id: string | null;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string | null;
};

type NotificationBellProps = {
  userId: string;
};

export function NotificationBell({ userId }: NotificationBellProps) {
  const supabase = useMemo(() => createClient(), []);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const unread = useMemo(
    () => notifications.filter((notification) => !notification.read_at).length,
    [notifications]
  );

  useEffect(() => {
    fetchNotifications();
  }, [userId]);

  useEffect(() => {
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  useEffect(() => {
    if (!open) return;

    const handleClick = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const fetchNotifications = async () => {
    const res = await fetch(`/api/notifications?userId=${userId}`);
    if (!res.ok) return;

    const data = (await res.json()) as Notification[];
    setNotifications(data);
  };

  const markAllRead = async () => {
    if (!unread) return;

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        read_at: notification.read_at || new Date().toISOString()
      }))
    );

    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId })
    });
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        aria-label="Notifications"
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-lg text-white shadow-sm backdrop-blur transition hover:bg-white/15 focus:outline-none focus:ring-4 focus:ring-blue-400/20"
        onClick={() => {
          setOpen((current) => !current);
          void markAllRead();
        }}
        type="button"
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-3 w-80 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/96 text-slate-100 shadow-[0_24px_80px_rgba(2,6,23,0.42)] backdrop-blur-2xl">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="text-sm font-bold text-white">Notifications</div>
            <div className="text-xs text-slate-400">
              Recent trip updates and comments
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length ? (
              notifications.map((notification) => (
                <div
                  className="border-b border-white/10 p-2 text-sm last:border-b-0"
                  key={notification.id}
                >
                  <div className="font-semibold text-white">
                    {notification.title || "New trip notification"}
                  </div>
                  {notification.body && (
                    <div className="mt-1 text-slate-300">{notification.body}</div>
                  )}
                  <div className="mt-1 text-xs text-slate-500">
                    {formatNotificationDate(notification.created_at)}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-sm text-slate-400">
                No notifications yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatNotificationDate(value: string | null) {
  if (!value) return "Just now";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
