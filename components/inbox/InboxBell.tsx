"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell } from "lucide-react";
import { markInboxSeen, useInbox } from "@/lib/inbox";
import { InboxIcon } from "@/components/inbox/InboxIcon";
import { PushToggle } from "@/components/inbox/PushToggle";

function ago(at: number, now: number): string {
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  const date = new Date(at);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// The bell in the header: a red count of what's new, and the list.
// Opening it marks everything as seen; what was new stays highlighted
// until it closes.
export function InboxBell() {
  const inbox = useInbox();
  const [open, setOpen] = useState(false);
  const [newAtOpen, setNewAtOpen] = useState<ReadonlySet<string>>(new Set());
  const [now, setNow] = useState(0);

  function toggle() {
    if (!open) {
      setNewAtOpen(new Set(inbox.items.filter((item) => !inbox.seen.has(item.id)).map((item) => item.id)));
      setNow(Date.now());
      markInboxSeen();
    }
    setOpen(!open);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={inbox.unseen ? `お知らせ（新着${inbox.unseen}件）` : "お知らせ"}
        aria-expanded={open}
        title="お知らせ"
        className="relative grid h-10 w-10 place-items-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10"
      >
        <Bell size={19} />
        {inbox.unseen > 0 && (
          <span className="absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-vermilion px-1 text-[10px] font-black leading-none text-white ring-2 ring-[color:var(--background)]">
            {inbox.unseen > 9 ? "9+" : inbox.unseen}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-0 cursor-default"
          />
          <div
            role="dialog"
            aria-label="お知らせ"
            className="panel-in fixed inset-x-3 top-[4.25rem] z-10 max-h-[70svh] overflow-y-auto overscroll-contain rounded-[22px] border-2 border-[color:var(--line)] bg-[color:var(--surface)] p-2 shadow-float sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96"
          >
            <p className="px-3 pb-1 pt-2 text-xs font-black tracking-[0.18em] text-[color:var(--muted)]">お知らせ</p>
            <div className="px-1 pb-1 pt-1 empty:hidden">
              <PushToggle />
            </div>
            {inbox.items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm font-bold text-[color:var(--muted)]">
                新しいお知らせはありません
              </p>
            ) : (
              <ul>
                {inbox.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-[color:var(--surface-muted)] ${
                        newAtOpen.has(item.id) ? "bg-vermilion/[0.07]" : ""
                      }`}
                    >
                      <InboxIcon kind={item.kind} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black leading-snug">{item.title}</span>
                        {item.body && (
                          <span className="block truncate text-xs font-bold text-[color:var(--muted)]">
                            {item.body}
                          </span>
                        )}
                        <span className="mt-0.5 block text-[11px] font-bold text-[color:var(--muted)]">
                          {ago(item.at, now)}
                        </span>
                      </span>
                      {newAtOpen.has(item.id) && (
                        <span aria-label="新着" className="h-2.5 w-2.5 shrink-0 rounded-full bg-vermilion" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
