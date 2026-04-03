"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck, Trash2, Filter } from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  type: string;
}

export default function InboxPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    api
      .get("/notifications")
      .catch(() => ({ data: { data: [] } }))
      .then((res) => {
        setItems(res.data?.data ?? res.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const markAllRead = () => setItems(items.map((i) => ({ ...i, read: true })));
  const deleteItem = (id: string) => setItems(items.filter((i) => i.id !== id));
  const visible = filter === "unread" ? items.filter((i) => !i.read) : items;
  const unreadCount = items.filter((i) => !i.read).length;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Bell className="w-4 h-4 text-violet-400" />
            Inbox
            {unreadCount > 0 && (
              <span className="text-[10px] bg-violet-600 text-white px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Notifications from agents and the system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-[var(--surface-overlay)] border border-[var(--surface-border)] rounded-lg p-0.5">
            {(["all", "unread"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-all capitalize",
                  filter === f
                    ? "bg-violet-600 text-white"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--surface-border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" /> Mark all read
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 mx-4 my-2 rounded-md bg-[var(--surface-overlay)] animate-pulse"
            />
          ))
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <CheckCheck className="w-10 h-10 text-green-500/30 mb-3" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              All caught up
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              No {filter === "unread" ? "unread " : ""}notifications
            </p>
          </div>
        ) : (
          visible.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-start gap-3 px-5 py-3.5 border-b border-[var(--surface-border)] hover:bg-[var(--surface-raised)] transition-colors",
                !item.read && "border-l-2 border-l-violet-500",
              )}
              onClick={() =>
                setItems(
                  items.map((i) =>
                    i.id === item.id ? { ...i, read: true } : i,
                  ),
                )
              }
            >
              <div
                className={cn(
                  "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                  item.read ? "bg-zinc-600" : "bg-violet-500",
                )}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {item.title}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                  {item.message}
                </p>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1 opacity-60">
                  {item.createdAt
                    ? new Date(item.createdAt).toLocaleString()
                    : "just now"}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteItem(item.id);
                }}
                className="text-[var(--text-secondary)] hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
