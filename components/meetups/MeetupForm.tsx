"use client";

import { useState } from "react";
import { BookMarked, Check, Globe, Lock, ShieldCheck, UserCheck, Zap } from "lucide-react";
import { GROUP_COVERS } from "@/lib/groupCovers";
import { GROUP_CATEGORIES, GROUP_CATEGORY_KEYS } from "@/lib/groupCategories";
import type { MeetupDraft } from "@/lib/api/meetups";
import type { GroupCover, PublicProfile } from "@/types";

const EMOJI = ["🚲", "♨️", "⛰️", "🍜", "📷", "🏯", "🌊", "🎒", "🍁", "🌸"];
const COVER_KEYS = Object.keys(GROUP_COVERS) as GroupCover[];
const CAPACITIES = [0, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 50];

export type SavedPlace = {
  id: string;
  name: string;
  prefecture: string;
  latitude: number;
  longitude: number;
};

const field =
  "w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--background)] px-4 py-3 text-sm font-medium outline-none focus:border-vermilion";
const label = "text-xs font-black text-[color:var(--muted)]";

function Segment<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; hint: string; icon: typeof Globe }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`rounded-xl border px-3 py-2.5 text-left transition ${
              active ? "border-vermilion bg-vermilion/10" : "border-[color:var(--line)]"
            }`}
          >
            <span className={`flex items-center gap-1.5 text-xs font-black ${active ? "text-vermilion" : ""}`}>
              <Icon size={14} />
              {option.label}
            </span>
            <span className="mt-0.5 block text-[10px] font-medium leading-4 text-[color:var(--muted)]">{option.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

// Create or edit an event. Friends to invite are offered only when given
// (creation); editing changes the details only.
export function MeetupForm({
  initial,
  today,
  places,
  friends,
  canOfficial = false,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<MeetupDraft>;
  today: string;
  places: SavedPlace[];
  friends?: PublicProfile[];
  canOfficial?: boolean;
  submitLabel: string;
  onSubmit: (draft: MeetupDraft, invitees: PublicProfile[]) => Promise<void>;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? EMOJI[0]);
  const [date, setDate] = useState(initial?.date ?? "");
  const [time, setTime] = useState(initial?.time ?? "");
  const [placeName, setPlaceName] = useState(initial?.placeName ?? "");
  const [placeLat, setPlaceLat] = useState<number | undefined>(initial?.placeLat);
  const [placeLon, setPlaceLon] = useState<number | undefined>(initial?.placeLon);
  const [pickPlace, setPickPlace] = useState(false);
  const [category, setCategory] = useState(initial?.category ?? "other");
  const [cover, setCover] = useState<GroupCover>(initial?.cover ?? "forest");
  const [capacity, setCapacity] = useState(initial?.capacity ?? 0);
  const [visibility, setVisibility] = useState(initial?.visibility ?? "public");
  const [joinPolicy, setJoinPolicy] = useState(initial?.joinPolicy ?? "approval");
  const [about, setAbout] = useState(initial?.about ?? "");
  const [official, setOfficial] = useState(initial?.official ?? false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editing = Boolean(initial?.title);
  const dateOk = Boolean(date) && (editing || date >= today);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return setError("イベント名を入れてね。");
    if (!dateOk) return setError("今日以降の日付を選んでね。");
    setBusy(true);
    setError(null);
    try {
      await onSubmit(
        {
          title: title.trim(),
          emoji,
          date,
          time: time || undefined,
          placeName: placeName.trim() || undefined,
          placeLat: placeName.trim() ? placeLat : undefined,
          placeLon: placeName.trim() ? placeLon : undefined,
          category,
          cover,
          capacity,
          visibility,
          joinPolicy,
          about: about.trim() || undefined,
          official: canOfficial ? official : (initial?.official ?? false),
        },
        (friends ?? []).filter((friend) => picked.has(friend.uid)),
      );
    } catch {
      setError("保存できませんでした。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {EMOJI.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setEmoji(option)}
            aria-pressed={emoji === option}
            className={`grid h-11 w-11 place-items-center rounded-2xl border text-2xl transition ${
              emoji === option ? "border-vermilion ring-2 ring-vermilion/30" : "border-[color:var(--line)]"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <div>
        <p className={label}>イベント名</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          placeholder="例: 六甲山ヒルクライムと有馬温泉"
          className={`mt-1.5 ${field}`}
        />
      </div>

      <div className="grid grid-cols-[1.4fr_1fr] gap-2">
        <div>
          <p className={label}>日付</p>
          <input
            type="date"
            value={date}
            min={editing ? undefined : today}
            onChange={(e) => setDate(e.target.value)}
            className={`mt-1.5 ${field}`}
          />
        </div>
        <div>
          <p className={label}>集合時間（任意）</p>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`mt-1.5 ${field}`} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <p className={label}>行き先・集合場所</p>
          {places.length > 0 && (
            <button
              type="button"
              onClick={() => setPickPlace((open) => !open)}
              className="inline-flex items-center gap-1 text-[11px] font-black text-sky"
            >
              <BookMarked size={13} />
              旅ノートから選ぶ
            </button>
          )}
        </div>
        <input
          value={placeName}
          onChange={(e) => {
            setPlaceName(e.target.value);
            setPlaceLat(undefined);
            setPlaceLon(undefined);
          }}
          maxLength={80}
          placeholder="例: 有馬温泉 金の湯 / 三宮駅 東口"
          className={`mt-1.5 ${field}`}
        />
        {pickPlace && (
          <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-[color:var(--line)] p-1.5">
            {places.map((place) => (
              <button
                key={place.id}
                type="button"
                onClick={() => {
                  setPlaceName(place.name);
                  setPlaceLat(place.latitude);
                  setPlaceLon(place.longitude);
                  setPickPlace(false);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold transition hover:bg-[color:var(--surface-muted)]"
              >
                <span className="truncate">{place.name}</span>
                <span className="shrink-0 text-[10px] font-bold text-[color:var(--muted)]">{place.prefecture}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className={label}>ジャンル</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {GROUP_CATEGORY_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={category === key}
              onClick={() => setCategory(key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                category === key
                  ? "border-vermilion bg-vermilion/10 text-vermilion"
                  : "border-[color:var(--line)] text-[color:var(--muted)]"
              }`}
            >
              {GROUP_CATEGORIES[key].emoji} {GROUP_CATEGORIES[key].label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className={label}>カバー</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {COVER_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-label={GROUP_COVERS[key].label}
              aria-pressed={cover === key}
              onClick={() => setCover(key)}
              className={`h-9 w-14 rounded-xl transition ${
                cover === key ? "ring-2 ring-[color:var(--foreground)] ring-offset-2 ring-offset-[color:var(--surface)]" : ""
              }`}
              style={{ background: GROUP_COVERS[key].css }}
            />
          ))}
        </div>
      </div>

      <div>
        <p className={label}>定員（主催者をふくむ）</p>
        <select
          value={capacity}
          onChange={(e) => setCapacity(Number(e.target.value))}
          className={`mt-1.5 ${field}`}
        >
          {CAPACITIES.map((value) => (
            <option key={value} value={value}>
              {value === 0 ? "制限なし" : `${value}人まで`}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <p className={label}>公開範囲</p>
        <Segment
          value={visibility}
          onChange={setVisibility}
          options={[
            { value: "public", label: "みんなに公開", hint: "イベント一覧に出て、誰でも参加を申し込める", icon: Globe },
            { value: "private", label: "招待のみ", hint: "招待したなかまだけに見える", icon: Lock },
          ]}
        />
        {visibility === "public" && (
          <Segment
            value={joinPolicy}
            onChange={setJoinPolicy}
            options={[
              { value: "approval", label: "承認制", hint: "申し込みを主催者が確認してから参加", icon: UserCheck },
              { value: "open", label: "自由参加", hint: "ボタンひとつで誰でも参加できる", icon: Zap },
            ]}
          />
        )}
      </div>

      <div>
        <p className={label}>説明（任意）</p>
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="ペース、持ち物、雨天のときなど"
          className={`mt-1.5 resize-none ${field}`}
        />
      </div>

      {friends && friends.length > 0 && (
        <div>
          <p className={label}>なかまを招待</p>
          <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
            {friends.map((friend) => {
              const active = picked.has(friend.uid);
              return (
                <button
                  key={friend.uid}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setPicked((current) => {
                      const next = new Set(current);
                      if (next.has(friend.uid)) next.delete(friend.uid);
                      else next.add(friend.uid);
                      return next;
                    })
                  }
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-bold transition ${
                    active ? "border-vermilion bg-vermilion/10" : "border-[color:var(--line)]"
                  }`}
                >
                  <span className="text-lg">{friend.avatarEmoji ?? "🐣"}</span>
                  <span className="min-w-0 flex-1 truncate">{friend.displayName ?? "旅人"}</span>
                  {active && <Check size={15} className="text-vermilion" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {canOfficial && (
        <label className="flex items-center gap-2 rounded-xl border border-[color:var(--line)] px-3 py-2.5 text-sm font-bold">
          <input type="checkbox" checked={official} onChange={(e) => setOfficial(e.target.checked)} />
          <ShieldCheck size={15} className="text-vermilion" />
          公式イベントにする（全員の一覧の先頭に表示）
        </label>
      )}

      {error && <p className="text-xs font-bold text-vermilion">{error}</p>}

      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-5 py-3 text-sm font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
          >
            キャンセル
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-full bg-vermilion px-5 py-3 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "保存中…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
