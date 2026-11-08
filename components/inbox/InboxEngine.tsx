"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { markInboxSeen, startInbox, useInbox, type InboxItem } from "@/lib/inbox";
import { refreshPush } from "@/lib/push";
import { InboxIcon } from "@/components/inbox/InboxIcon";

// Runs the お知らせ for the signed-in traveller (mounted once in the
// layout) and pops a small card when something new arrives while the app
// is open — unless you're already looking at it.
export function InboxEngine() {
  const { user } = useAuth();
  const uid = user?.uid;

  useEffect(() => {
    if (!uid) return;
    void refreshPush(uid).catch(() => undefined);
    return startInbox(uid);
  }, [uid]);

  return <InboxToast />;
}

function InboxToast() {
  const inbox = useInbox();
  const pathname = usePathname();
  // Items already known, so only arrivals pop up (not the first load).
  const [known, setKnown] = useState<{ items: InboxItem[] | null; ids: Set<string> }>({
    items: null,
    ids: new Set(),
  });
  const [toast, setToast] = useState<InboxItem | null>(null);

  if (!inbox.ready && known.items !== null) {
    setKnown({ items: null, ids: new Set() });
  } else if (inbox.ready && inbox.items !== known.items) {
    const arrived =
      known.items === null
        ? []
        : inbox.items.filter(
            (item) => !known.ids.has(item.id) && !inbox.seen.has(item.id) && item.href !== pathname,
          );
    setKnown({ items: inbox.items, ids: new Set([...known.ids, ...inbox.items.map((item) => item.id)]) });
    if (arrived.length) setToast(arrived[0]);
  }

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[2100] flex justify-center px-4">
      <div
        role="status"
        className="panel-in pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--surface)] p-3 shadow-float"
      >
        <Link
          href={toast.href}
          onClick={() => {
            markInboxSeen((item) => item.id === toast.id);
            setToast(null);
          }}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <InboxIcon kind={toast.kind} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-black">{toast.title}</span>
            {toast.body && (
              <span className="block truncate text-xs font-bold text-[color:var(--muted)]">{toast.body}</span>
            )}
          </span>
        </Link>
        <button
          type="button"
          aria-label="閉じる"
          onClick={() => setToast(null)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--surface-muted)]"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
