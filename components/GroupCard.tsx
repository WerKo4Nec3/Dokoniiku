"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Globe, Lock, UsersRound } from "lucide-react";
import type { Group } from "@/types";
import { coverCss } from "@/lib/groupCovers";

// VK-style group card: a gradient cover rail with the emoji chip, then name +
// visibility pill + about snippet + member count. `href` makes the whole card a
// link (my groups); otherwise pass a `trailing` control (e.g. a Join button).
export function GroupCard({
  group,
  isOwner,
  href,
  trailing,
}: {
  group: Group;
  isOwner?: boolean;
  href?: string;
  trailing?: ReactNode;
}) {
  const inner = (
    <>
      <div
        className="relative w-16 shrink-0 overflow-hidden"
        style={{ background: coverCss(group.cover) }}
      >
        <span className="absolute inset-0 grid place-items-center text-2xl drop-shadow">
          {group.emoji ?? "⛺"}
        </span>
      </div>
      <div className="min-w-0 flex-1 py-3 pl-3 pr-2">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-black">{group.name}</span>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              group.visibility === "public"
                ? "bg-sky/15 text-[#3f8ea0] dark:text-sky"
                : "bg-[color:var(--surface-muted)] text-[color:var(--muted)]"
            }`}
          >
            {group.visibility === "public" ? (
              <Globe size={10} />
            ) : (
              <Lock size={10} />
            )}
            {group.visibility === "public" ? "公開" : "非公開"}
          </span>
        </div>
        {group.about && (
          <p className="mt-0.5 line-clamp-1 text-xs text-[color:var(--muted)]">
            {group.about}
          </p>
        )}
        <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[color:var(--muted)]">
          <UsersRound size={12} /> {group.members.length}人
          {isOwner && " ・ あなたが管理"}
        </p>
      </div>
      {trailing && (
        <div className="flex shrink-0 items-center pr-3">{trailing}</div>
      )}
    </>
  );

  const boxClass =
    "flex overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] shadow-float transition hover:border-vermilion/50";

  if (href) {
    return (
      <Link href={href} className={boxClass}>
        {inner}
      </Link>
    );
  }
  return <div className={boxClass}>{inner}</div>;
}
