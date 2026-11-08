import { CircleCheck, Mail, MapPinned, MessageCircle, UserPlus, UsersRound } from "lucide-react";
import type { InboxKind } from "@/lib/inbox";

const KINDS: Record<InboxKind, { icon: typeof Mail; tone: string }> = {
  invite: { icon: Mail, tone: "bg-[#7c6be6] text-white" },
  request: { icon: UsersRound, tone: "bg-sun text-[#3b2a06]" },
  approved: { icon: CircleCheck, tone: "bg-forest text-white" },
  message: { icon: MessageCircle, tone: "bg-sky text-white" },
  friend: { icon: UserPlus, tone: "bg-[#5aa94a] text-white" },
  share: { icon: MapPinned, tone: "bg-vermilion text-white" },
};

// The round coloured symbol for one kind of お知らせ.
export function InboxIcon({ kind, size = "md" }: { kind: InboxKind; size?: "sm" | "md" }) {
  const { icon: Icon, tone } = KINDS[kind];
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full ${tone} ${size === "sm" ? "h-8 w-8" : "h-10 w-10"}`}
    >
      <Icon size={size === "sm" ? 16 : 19} strokeWidth={2.4} />
    </span>
  );
}
