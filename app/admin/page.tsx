"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Copy,
  UsersRound,
  Eye,
  RefreshCw,
  Search,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  UserPlus,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { openAuthDialog } from "@/components/AuthDialog";
import { prefectures } from "@/data/prefectures";
import { categoryLabels } from "@/lib/utils/travel";
import type { DestinationCategory } from "@/types";
import { isExcluded } from "@/lib/api/ratings";
import {
  checkAdmin,
  loadCounts,
  loadDaily,
  loadFlaggedPlaces,
  loadTotals,
  setWhitelisted,
  type CountRow,
  type DailyStat,
  type FlaggedPlace,
  type Totals,
} from "@/lib/api/admin";
import {
  AreaChart,
  ChartCard,
  ColumnChart,
  compact,
  HBarChart,
  type Point,
} from "@/components/admin/Charts";

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];
const prefName = new Map(prefectures.map((p) => [p.id, p.nameJa]));

function StatTile({
  icon: Icon,
  label,
  value,
  delta,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  delta?: { value: number; vs: string };
}) {
  const up = (delta?.value ?? 0) > 0;
  const down = (delta?.value ?? 0) < 0;
  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-bold text-[color:var(--muted)]">
        <Icon size={13} />
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-black">{value.toLocaleString("ja-JP")}</p>
      {delta && (
        <p
          className={`mt-0.5 text-[11px] font-bold ${
            up ? "text-forest-ink" : down ? "text-[color:var(--brand-ink)]" : "text-[color:var(--muted)]"
          }`}
        >
          {up ? "▲" : down ? "▼" : "±"} {Math.abs(delta.value).toLocaleString("ja-JP")}
          <span className="font-medium text-[color:var(--muted)]"> {delta.vs}</span>
        </p>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { enabled, loading, user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [range, setRange] = useState<Range>(30);
  const [daily, setDaily] = useState<DailyStat[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [prefs, setPrefs] = useState<CountRow[]>([]);
  const [cats, setCats] = useState<CountRow[]>([]);
  const [flagged, setFlagged] = useState<FlaggedPlace[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsAdmin(null);
      return;
    }
    let active = true;
    checkAdmin(user.uid).then((ok) => active && setIsAdmin(ok));
    return () => {
      active = false;
    };
  }, [user]);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [d, t, p, c, f] = await Promise.allSettled([
        loadDaily(90),
        loadTotals(),
        loadCounts("stats_prefs"),
        loadCounts("stats_cats"),
        loadFlaggedPlaces(),
      ]);
      if (d.status === "fulfilled") setDaily(d.value);
      if (t.status === "fulfilled") setTotals(t.value);
      if (p.status === "fulfilled") setPrefs(p.value);
      if (c.status === "fulfilled") setCats(c.value);
      if (f.status === "fulfilled") setFlagged(f.value);
      if ([d, t, p, c, f].some((r) => r.status === "rejected")) {
        setError("一部のデータを読み込めませんでした。firestore.rules がデプロイ済みか確認してください。");
      }
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const slice = useMemo(() => (daily ?? []).slice(-range), [daily, range]);
  const series = (key: keyof Omit<DailyStat, "date">): Point[] =>
    slice.map((d) => ({ label: d.date, value: d[key] }));
  const sum = (key: keyof Omit<DailyStat, "date">) =>
    slice.reduce((acc, d) => acc + d[key], 0);
  const today = daily?.[daily.length - 1];
  const yesterday = daily?.[daily.length - 2];
  const dayBefore = daily?.[daily.length - 3];
  // Only claim a start date when tracking began inside the loaded 90 days.
  const firstIdx = daily ? daily.findIndex((d) => d.visitors || d.sessions || d.searches) : -1;
  const trackingNote =
    daily && firstIdx > 0
      ? `計測開始: ${daily[firstIdx].date}`
      : firstIdx === 0
        ? "90日以上前から計測中"
        : "計測はデプロイ後から始まります。";

  // Counter docs can be created by anyone — chart only known ids.
  const prefAll: Point[] = prefs
    .filter((r) => prefName.has(r.id))
    .map((r) => ({ label: prefName.get(r.id) ?? r.id, value: r.n }));
  const prefRows = prefAll.slice(0, 10);
  const catRows: Point[] = cats
    .filter((r) => r.id in categoryLabels)
    .map((r) => ({
      label: categoryLabels[r.id as DestinationCategory],
      value: r.n,
    }));
  const tableOf = (pts: Point[]) => pts.map((p) => [p.label, p.value.toLocaleString("ja-JP")] as [string, string]);

  async function toggleWhitelist(place: FlaggedPlace) {
    if (pending) return;
    const next = !place.whitelisted;
    setPending(place.id);
    try {
      await setWhitelisted(place.id, next);
      setFlagged((list) =>
        list.map((p) =>
          p.id === place.id
            ? { ...p, whitelisted: next, excluded: isExcluded(p.up, p.down, next) }
            : p,
        ),
      );
    } catch {
      setError("更新できませんでした。");
    } finally {
      setPending(null);
    }
  }

  // ---- Gates ----
  if (!enabled) {
    return <Shell><p className="text-sm text-[color:var(--muted)]">Firebase が設定されていません。</p></Shell>;
  }
  if (loading || (user && isAdmin === null)) {
    return <Shell><p className="text-sm text-[color:var(--muted)]">確認中…</p></Shell>;
  }
  if (!user) {
    return (
      <Shell>
        <p className="text-sm text-[color:var(--muted)]">管理者アカウントでログインしてください。</p>
        <button
          type="button"
          onClick={() => openAuthDialog()}
          className="mt-4 rounded-full bg-vermilion px-5 py-2.5 text-sm font-black text-white"
        >
          ログイン
        </button>
      </Shell>
    );
  }
  if (!isAdmin) {
    return (
      <Shell>
        <p className="text-sm font-bold">このアカウントには管理者権限がありません。</p>
        <p className="mt-2 text-xs leading-6 text-[color:var(--muted)]">
          Firebase Console → Firestore Database で、コレクション <code className="font-bold">admins</code> に
          ドキュメント ID = 下の UID のドキュメントを作成してください（フィールドは空で OK）。その後このページを再読み込みします。
        </p>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(user.uid).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[color:var(--line)] px-3 py-2 font-mono text-xs"
        >
          <Copy size={13} />
          {user.uid}
          <span className="font-sans font-bold text-forest-ink">{copied ? "コピーしました" : ""}</span>
        </button>
      </Shell>
    );
  }

  // ---- Dashboard ----
  return (
    <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-6xl px-4 pb-20 pt-24 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-sm font-bold text-vermilion">
            <ShieldCheck size={15} /> ADMIN
          </p>
          <h1 className="mt-1 text-3xl font-black">管理ダッシュボード</h1>
          <p className="mt-1 text-xs font-medium text-[color:var(--muted)]">
            日付は日本時間。{trackingNote}
          </p>
        </div>
        {/* One filter row above everything it scopes */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  range === r ? "bg-vermilion text-white" : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                }`}
              >
                {r}日
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            aria-label="再読み込み"
            className="grid h-9 w-9 place-items-center rounded-full border border-[color:var(--line)] text-[color:var(--muted)] transition hover:text-[color:var(--foreground)] disabled:opacity-50"
          >
            <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-vermilion/10 px-4 py-3 text-xs font-bold text-[color:var(--brand-ink)]">
          {error}
        </p>
      )}

      <div className={`mt-6 space-y-6 transition-opacity ${busy && daily ? "opacity-60" : ""}`}>
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatTile icon={Users} label="ユーザー数（計測開始以降）" value={totals?.users ?? 0} />
          <StatTile icon={Users} label="今日のアクティブ" value={totals?.activeToday ?? 0} />
          <StatTile icon={Users} label="7日間のアクティブ" value={totals?.active7d ?? 0} />
          <StatTile icon={UsersRound} label="グループ数" value={totals?.groups ?? 0} />
          <StatTile icon={ThumbsUp} label="評価された場所" value={totals?.ratedPlaces ?? 0} />
          <StatTile icon={Eye} label="今日の訪問者（途中経過）" value={today?.visitors ?? 0} />
          <StatTile
            icon={Eye}
            label="昨日の訪問者"
            value={yesterday?.visitors ?? 0}
            delta={yesterday && dayBefore ? { value: yesterday.visitors - dayBefore.visitors, vs: "一昨日比" } : undefined}
          />
          <StatTile icon={Search} label={`検索（${range}日）`} value={sum("searches")} />
          <StatTile icon={BarChart3} label={`保存（${range}日）`} value={sum("saves")} />
          <StatTile icon={UserPlus} label={`新規登録（${range}日）`} value={sum("signups")} />
        </div>
        <p className="-mt-3 text-[11px] font-medium text-[color:var(--muted)]">
          ユーザー数は計測開始後にログインした人の数です（以前からのアカウントは、次に来たときに加算されます）。
          正確な総アカウント数は Firebase Console → Authentication で確認できます。
        </p>

        {/* Time series — one measure per chart (never a dual axis) */}
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="訪問者数"
            subtitle={`1日あたりのユニーク訪問者（ブラウザ単位）・合計 ${compact(sum("visitors"))}`}
            table={{ columns: ["日付", "訪問者"], rows: tableOf(series("visitors")).reverse() }}
          >
            <AreaChart data={series("visitors")} unit="人" />
          </ChartCard>
          <ChartCard
            title="検索数"
            subtitle={`行き先を決めた回数・合計 ${compact(sum("searches"))}`}
            table={{ columns: ["日付", "検索"], rows: tableOf(series("searches")).reverse() }}
          >
            <ColumnChart data={series("searches")} unit="回" />
          </ChartCard>
          <ChartCard
            title="セッション数"
            subtitle={`サイトを開いた回数（タブ単位）・合計 ${compact(sum("sessions"))}`}
            table={{ columns: ["日付", "セッション"], rows: tableOf(series("sessions")).reverse() }}
          >
            <AreaChart data={series("sessions")} unit="回" />
          </ChartCard>
          <ChartCard
            title="新規登録"
            subtitle={`新しく作られたアカウント・合計 ${compact(sum("signups"))}`}
            table={{ columns: ["日付", "新規"], rows: tableOf(series("signups")).reverse() }}
          >
            <ColumnChart data={series("signups")} unit="人" />
          </ChartCard>
        </div>

        {/* Rankings (all-time) */}
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="人気の都道府県 TOP10"
            subtitle="累計の検索数"
            table={{ columns: ["都道府県", "検索"], rows: tableOf(prefAll) }}
          >
            <HBarChart rows={prefRows} unit="回" />
          </ChartCard>
          <ChartCard
            title="ジャンル別"
            subtitle="選ばれた場所のジャンル（累計）"
            table={{ columns: ["ジャンル", "回数"], rows: tableOf(catRows) }}
          >
            <HBarChart rows={catRows} unit="回" />
          </ChartCard>
        </div>

        {/* Exclusion list management */}
        <section className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
          <h3 className="text-sm font-black">評価の低い場所（除外リスト）</h3>
          <p className="mt-0.5 text-[11px] font-medium text-[color:var(--muted)]">
            👎 3件以上かつ 👍 の2倍以上で自動的に抽選から外れます。誤って外れた場所は「復活」で戻せます。
          </p>
          {flagged.length === 0 ? (
            <p className="mt-4 text-xs font-medium text-[color:var(--muted)]">対象の場所はありません。</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-xs">
                <thead>
                  <tr className="text-[color:var(--muted)]">
                    <th className="py-2 font-bold">場所</th>
                    <th className="py-2 font-bold">都道府県</th>
                    <th className="py-2 text-right font-bold">👍</th>
                    <th className="py-2 text-right font-bold">👎</th>
                    <th className="py-2 font-bold">状態</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {flagged.map((p) => (
                    <tr key={p.id} className="border-t border-[color:var(--line)]">
                      <td className="py-2 font-bold">{p.name}</td>
                      <td className="py-2">{p.prefecture}</td>
                      <td className="py-2 text-right tabular-nums">
                        <span className="inline-flex items-center gap-1"><ThumbsUp size={11} />{p.up}</span>
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        <span className="inline-flex items-center gap-1"><ThumbsDown size={11} />{p.down}</span>
                      </td>
                      <td className="py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                            p.whitelisted
                              ? "bg-forest/10 text-forest-ink"
                              : p.excluded
                                ? "bg-vermilion/10 text-[color:var(--brand-ink)]"
                                : "bg-[color:var(--surface-muted)] text-[color:var(--muted)]"
                          }`}
                        >
                          {p.whitelisted ? "復活済み" : p.excluded ? "除外中" : "注意"}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => void toggleWhitelist(p)}
                          disabled={pending !== null}
                          className="rounded-full border border-[color:var(--line)] px-3 py-1 text-[11px] font-bold transition hover:border-vermilion/50 disabled:opacity-50"
                        >
                          {p.whitelisted ? "除外に戻す" : "復活させる"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-lg px-4 pb-20 pt-32 sm:px-6">
      <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-6">
        <p className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-vermilion">
          <ShieldCheck size={15} /> 管理ダッシュボード
        </p>
        {children}
      </div>
    </section>
  );
}
