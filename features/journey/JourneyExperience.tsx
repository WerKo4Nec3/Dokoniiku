"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  Bike,
  Bookmark,
  CalendarDays,
  Car,
  Check,
  Link2,
  ChevronRight,
  Cloud,
  CloudRain,
  ExternalLink,
  Footprints,
  Globe,
  House,
  Info,
  LocateFixed,
  MapPin,
  Moon,
  RotateCcw,
  Route,
  Share2,
  Shuffle,
  Snowflake,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Tent,
  Ticket,
  TrainFront,
  Users,
  Utensils,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { DEFAULT_START, directions, prefectures } from "@/data/prefectures";
import { startPointPresets } from "@/data/startPoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getAttractionsByPrefecture } from "@/lib/api/places";
import {
  fetchRecentForUser,
  saveJourneyForUser,
  saveRecentForUser,
} from "@/lib/api/savedJourneys";
import { getWeatherByCoordinates } from "@/lib/api/weather";
import { readPreferences } from "@/lib/preferences";
import { encodeTrip } from "@/lib/tripShare";
import { getExcludedPlaceIds } from "@/lib/api/ratings";
import { PlaceRating } from "@/components/PlaceRating";
import {
  getDestinationImages,
  getDestinationSummary,
  getNearbyPhotos,
  looksLikePhoto,
  mergePhotos,
  searchCommonsPhotos,
} from "@/lib/api/wikipedia";
import { getOpenversePhotos } from "@/lib/api/openverse";
import {
  getRecentSnapshot,
  parseRecentSnapshot,
  pushRecentJourney,
  subscribeRecent,
} from "@/lib/storage/recentJourneys";
import {
  getStartPointSnapshot,
  parseStartPointSnapshot,
  storeStartPoint,
  subscribeStartPoint,
} from "@/lib/storage/startPoint";
import { buildShareCard } from "@/lib/share/shareCard";
import {
  allTransportModes,
  bestTransport,
  categoryLabels,
  CURRENT_SEASON,
  estimateBudget,
  estimateTravelTime,
  formatMinutes,
  formatYen,
  googleMapsSearchUrl,
  haversineDistanceKm,
  isSeasonalMatch,
  journeyDifficulty,
  NEARBY_PREFECTURE_LIMIT_KM,
  pickDirection,
  pickPrefecture,
  randomItem,
  seasonInfo,
  transportInfo,
  transportLabel,
} from "@/lib/utils/travel";
import type {
  Destination,
  DestinationCategory,
  Direction,
  JourneyResult,
  Prefecture,
  StartPoint,
  TransportMode,
  WeatherInfo,
} from "@/types";
import { ActionButton } from "@/components/ui/ActionButton";
import {
  DifficultyBadge,
  difficultyFrameClass,
} from "@/components/DifficultyBadge";
import {
  CATEGORY_ORDER,
  CategoryCard,
} from "@/components/journey/CategoryCard";
import { TabiMascot } from "@/features/mascot/TabiMascot";
import { ImageGallery } from "./ImageGallery";
import {
  FactsCard,
  MenuCard,
  NearbyCard,
  VideosCard,
} from "./PlaceSections";
import { JourneySkeleton } from "./JourneySkeleton";

// Leaflet touches `window`, so load the interactive map client-side only.
const PlaceMap = dynamic(() => import("./PlaceMap"), {
  ssr: false,
  loading: () => (
    <div className="h-60 w-full animate-pulse bg-[color:var(--surface-muted)]" />
  ),
});
const RevealMap = dynamic(() => import("./RevealMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse bg-[color:var(--surface-muted)]" />
  ),
});
const ShuffleMap = dynamic(() => import("./ShuffleMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse bg-[color:var(--surface-muted)]" />
  ),
});

type Stage =
  | "landing"
  | "direction"
  | "prefecture"
  | "shuffle"
  | "loading"
  | "result";
type JourneyMode = "surprise" | "custom";
type TripLengthId = "day" | "one-night" | "two-night";

// A destination paired with the transport that will be used to reach it.
type Plan = { destination: Destination; transport: TransportMode };

// Module-scope wrappers: these run only inside event handlers, but the
// react-hooks purity lint cannot see that through indirect calls.
const nowMs = () => Date.now();
const nowIso = () => new Date().toISOString();
function makeJourneyId(destinationId: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${nowMs()}-${destinationId}`;
}

function sampleItems<T>(items: T[], count: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

// Half the time, prefer places whose genre fits the current season
// (spring parks, winter onsen...); otherwise pick freely.
function pickPlanWithSeasonBoost(pool: Plan[]): Plan {
  const seasonal = pool.filter((plan) =>
    isSeasonalMatch(plan.destination.categories),
  );
  if (seasonal.length && Math.random() < 0.5) return randomItem(seasonal);
  return randomItem(pool);
}

// Soft-bias the pick toward the traveller's favourite genres (~65% of the
// time when any match), while still keeping the seasonal nudge and room for
// discovery. Falls back to the season boost when there are no preferences.
function pickPlanWithBoost(pool: Plan[], preferred: DestinationCategory[]): Plan {
  if (preferred.length) {
    const liked = pool.filter((plan) =>
      plan.destination.categories.some((category) =>
        preferred.includes(category),
      ),
    );
    if (liked.length && Math.random() < 0.65) {
      return pickPlanWithSeasonBoost(liked);
    }
  }
  return pickPlanWithSeasonBoost(pool);
}

// Deal a hand of cards that leans toward favourite genres (~2/3) but keeps a
// couple of wildcards for discovery. Plain random when there are no favourites.
function sampleWithPreference(
  plans: Plan[],
  count: number,
  preferred: DestinationCategory[],
): Plan[] {
  if (!preferred.length) return sampleItems(plans, count);
  const liked = plans.filter((plan) =>
    plan.destination.categories.some((category) =>
      preferred.includes(category),
    ),
  );
  const likedIds = new Set(liked.map((plan) => plan.destination.id));
  const rest = plans.filter((plan) => !likedIds.has(plan.destination.id));
  const wantLiked = Math.min(liked.length, Math.ceil(count * 0.66));
  const pickedLiked = sampleItems(liked, wantLiked);
  const pickedRest = sampleItems(rest, count - pickedLiked.length);
  return sampleItems([...pickedLiked, ...pickedRest], count);
}

// Shared entrance animation: parents stagger their fadeUp children.
const staggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

// Smoothly expands/collapses togglable panels.
function ExpandPanel({
  open,
  className,
  children,
}: {
  open: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className={`w-full overflow-hidden ${className ?? ""}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// A big tactile choice tile, used for the landing mode + scope pickers.
function ChoiceCard({
  active,
  onClick,
  visual,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  visual: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={`group relative flex flex-col items-center gap-2.5 rounded-2xl border p-4 text-center transition ${
        active
          ? "border-vermilion bg-vermilion/5 shadow-float"
          : "border-[color:var(--line)] bg-[color:var(--surface)] hover:border-vermilion/50 hover:bg-vermilion/[0.03]"
      }`}
    >
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[color:var(--surface-muted)] text-vermilion">
        {visual}
      </span>
      <span className="text-sm font-black text-[color:var(--foreground)]">
        {title}
      </span>
      <span className="-mt-1 text-xs font-medium text-[color:var(--muted)]">
        {subtitle}
      </span>
      <AnimatePresence>
        {active && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full bg-vermilion text-white shadow-sm"
          >
            <Check size={14} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}


// Fill percent (0..100) for a .range-brand slider's --fill.
function sliderFill(value: number, min: number, max: number): number {
  return Math.round(((value - min) / (max - min)) * 100);
}

const tripLengthIcons: Record<TripLengthId, LucideIcon> = {
  day: Sun,
  "one-night": Moon,
  "two-night": Tent,
};

// Card wrapper for one trip parameter (budget / distance / transport …).
function KnobCard({
  icon: Icon,
  title,
  value,
  children,
}: {
  icon: LucideIcon;
  title: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-bold text-[color:var(--foreground)]">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-vermilion/10 text-vermilion">
            <Icon size={16} />
          </span>
          {title}
        </span>
        {value != null && (
          <span className="rounded-full bg-[color:var(--surface-muted)] px-2.5 py-1 text-xs font-black tabular-nums text-[color:var(--foreground)]">
            {value}
          </span>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

// Trip length → how long one-way travel may take (round trip is double).
const tripLengthOptions: {
  id: TripLengthId;
  labelJa: string;
  maxOneWayMinutes: number;
}[] = [
  { id: "day", labelJa: "日帰り", maxOneWayMinutes: 180 },
  { id: "one-night", labelJa: "1泊2日", maxOneWayMinutes: 360 },
  { id: "two-night", labelJa: "2泊3日", maxOneWayMinutes: 600 },
];

const transportIcons: Record<
  TransportMode,
  typeof Footprints
> = {
  walk: Footprints,
  bicycle: Bike,
  motorbike: Bike,
  car: Car,
  train: TrainFront,
  shinkansen: TrainFront,
};

const BUDGET_MIN = 5000;
// The budget slider is a party-total cap, so its ceiling scales with the
// headcount — 20 people over a long distance can easily pass ¥1,000,000.
const BUDGET_PER_PERSON_MAX = 60000;
const DISTANCE_MAX = 800;
const SHUFFLE_COUNT = 4;

// Gemini-powered place insight is optional; the UI only appears when enabled.
const aiEnabled = process.env.NEXT_PUBLIC_GEMINI_ENABLED === "true";

const directionAngles: Record<Direction, number> = {
  北: 0,
  北東: 45,
  東: 90,
  南東: 135,
  南: 180,
  南西: 225,
  西: 270,
  北西: 315,
};

const reasonTexts = [
  "今日は少しだけ遠くへ。景色が変わると、気分もちゃんと切り替わるよ。",
  "予定を詰めすぎない旅にぴったり。寄り道の時間も残しておこう。",
  "自然と歴史をどちらも味わえる場所。歩きやすい靴で行こう。",
  "朝のうちに出発すれば、のんびり過ごしても余裕がありそう。",
];

function WeatherIcon({ weather }: { weather: WeatherInfo }) {
  const icons = {
    sun: Sun,
    cloud: Cloud,
    rain: CloudRain,
    snow: Snowflake,
  };
  const Icon = icons[weather.icon];
  return <Icon className="text-sky" size={28} aria-hidden="true" />;
}

// "2026-09-26" → "9/26（土）" for the forecast label.
const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];
function weatherDateLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const weekday = WEEKDAY_JA[new Date(y, m - 1, d).getDay()];
  return `${m}/${d}（${weekday}）`;
}

function TransportIcon({
  mode,
  className,
  size = 21,
}: {
  mode: TransportMode;
  className?: string;
  size?: number;
}) {
  const Icon = transportIcons[mode];
  return <Icon size={size} className={className} aria-hidden="true" />;
}

export function JourneyExperience() {
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>("landing");
  const [direction, setDirection] = useState<Direction | null>(null);
  const [prefecture, setPrefecture] = useState<Prefecture | null>(null);
  const [journey, setJourney] = useState<JourneyResult | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [filterNotice, setFilterNotice] = useState<string | null>(null);
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<DestinationCategory[]>([]);
  const [scope, setScope] = useState<"nearby" | "all">("nearby");
  const [people, setPeople] = useState(1);

  // "Подбор с настройками" (custom) mode.
  const [journeyMode, setJourneyMode] = useState<JourneyMode>("surprise");
  const [budget, setBudget] = useState(30000);
  const [tripLength, setTripLength] = useState<TripLengthId>("day");
  const [maxDistance, setMaxDistance] = useState(200);
  const [transports, setTransports] = useState<TransportMode[]>([
    "train",
    "car",
    "shinkansen",
  ]);
  const [allowTransfer, setAllowTransfer] = useState(false);
  // Party-total budget cap grows with the headcount so large groups aren't
  // stuck under a fixed ¥100,000 ceiling that no plan can ever satisfy.
  const budgetMax = Math.max(BUDGET_MIN, BUDGET_PER_PERSON_MAX * people);
  const [savedJourneyId, setSavedJourneyId] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPlan, setAiPlan] = useState<string | null>(null);
  const [aiPlanLoading, setAiPlanLoading] = useState(false);
  const [shufflePool, setShufflePool] = useState<{
    plans: Plan[];
    providerMock: boolean;
    placesNotice?: string;
  } | null>(null);
  const [shuffleOptions, setShuffleOptions] = useState<Plan[]>([]);
  const [shuffleHover, setShuffleHover] = useState<string | null>(null);
  const [revealTarget, setRevealTarget] = useState<{
    latitude: number;
    longitude: number;
    name: string;
    prefecture: string;
  } | null>(null);
  // Warm up the map chunks early so the reveal starts instantly.
  useEffect(() => {
    if (stage === "direction" || stage === "prefecture") {
      void import("./RevealMap");
      void import("./ShuffleMap");
    }
  }, [stage]);

  // Resolved by RevealMap when the fly-in lands (see finalizePlan).
  const revealLanded = useRef<(() => void) | null>(null);
  const shufflePoints = useMemo(
    () =>
      shuffleOptions.map((plan) => ({
        id: plan.destination.id,
        name: plan.destination.name,
        latitude: plan.destination.latitude,
        longitude: plan.destination.longitude,
      })),
    [shuffleOptions],
  );

  const { user, enabled: authEnabled, signInWithGoogle } = useAuth();

  const startSnapshot = useSyncExternalStore(
    subscribeStartPoint,
    getStartPointSnapshot,
    () => "",
  );
  const start = parseStartPointSnapshot(startSnapshot) ?? DEFAULT_START;

  const recentSnapshot = useSyncExternalStore(
    subscribeRecent,
    getRecentSnapshot,
    () => "[]",
  );
  const localRecent = parseRecentSnapshot(recentSnapshot);
  // When signed in, recent history syncs with the account (cloud); otherwise
  // it stays in localStorage. null = cloud not loaded yet.
  const [cloudRecent, setCloudRecent] = useState<JourneyResult[] | null>(null);
  const recentJourneys = user && cloudRecent ? cloudRecent : localRecent;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [stage]);

  // Keep the chosen budget within the (headcount-dependent) ceiling.
  useEffect(() => {
    setBudget((current) => Math.min(current, budgetMax));
  }, [budgetMax]);

  // The header logo taps back to the very start even when we're already on
  // "/" (where a same-route link wouldn't reset our internal stage).
  useEffect(() => {
    function goHome() {
      setStage("landing");
      setDirection(null);
      setPrefecture(null);
      setJourney(null);
      setNotice(null);
      setFilterNotice(null);
      setSelecting(false);
      setShufflePool(null);
      setShuffleOptions([]);
    }
    window.addEventListener("dokoniiku:go-home", goHome);
    return () => window.removeEventListener("dokoniiku:go-home", goHome);
  }, []);

  // A saved card clicked on /saved hands the journey over via
  // sessionStorage; reopen it here as the full result view.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = sessionStorage.getItem("dokoniiku:view-journey");
        if (!raw) return;
        sessionStorage.removeItem("dokoniiku:view-journey");
        const item = JSON.parse(raw) as JourneyResult;
        if (!item?.destination?.name || !item?.prefecture?.nameJa) return;
        setDirection(item.direction);
        setPrefecture(item.prefecture);
        setJourney(item);
        setStage("result");
      } catch {
        // corrupt handoff — stay on the landing
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // On sign-in, load the account's recent history and merge in any local
  // history made while signed out; keep the newest five, newest first.
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const cloud = await fetchRecentForUser(user.uid).catch(() => []);
      const local = parseRecentSnapshot(getRecentSnapshot());
      const merged = [
        ...cloud,
        ...local.filter((l) => !cloud.some((c) => c.id === l.id)),
      ]
        .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
        .slice(0, 5);
      if (!active) return;
      setCloudRecent(merged);
      if (merged.length > cloud.length) {
        saveRecentForUser(user.uid, merged).catch(() => {});
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  function chooseStart(point: StartPoint) {
    storeStartPoint(point);
    setStartPickerOpen(false);
    setLocationError(null);
  }

  function useCurrentLocation() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocationError("この端末では現在地を取得できません。");
      return;
    }

    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        chooseStart({
          name: "現在地",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setLocating(false);
        setLocationError("現在地を取得できませんでした。リストから選んでください。");
      },
      { timeout: 8000 },
    );
  }

  function toggleCategory(category: DestinationCategory) {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  }

  function resetFilters() {
    setSelectedCategories([]);
  }

  function toggleTransport(mode: TransportMode) {
    setTransports((current) =>
      current.includes(mode)
        ? current.filter((item) => item !== mode)
        : [...current, mode],
    );
  }

  const maxOneWayMinutes =
    tripLengthOptions.find((option) => option.id === tripLength)
      ?.maxOneWayMinutes ?? 180;

  function beginDirectionSelection() {
    setStage("direction");
    setDirection(null);
    setPrefecture(null);
    setJourney(null);
    setNotice(null);
    setFilterNotice(null);
    setSelecting(true);

    window.setTimeout(() => {
      setDirection(pickDirection());
      setSelecting(false);
    }, 1400);
  }

  function returnToStart() {
    setStage("landing");
    setDirection(null);
    setPrefecture(null);
    setJourney(null);
    setNotice(null);
    setFilterNotice(null);
    setSelecting(false);
    setShufflePool(null);
    setShuffleOptions([]);
  }

  function choosePrefecture() {
    if (!direction) return;
    let pool: Prefecture[];
    if (journeyMode === "custom") {
      // Custom: keep prefectures within the chosen max distance.
      pool = prefectures.filter(
        (item) => haversineDistanceKm(start, item) <= maxDistance,
      );
    } else if (scope === "all") {
      pool = prefectures;
    } else {
      pool = prefectures.filter(
        (item) =>
          haversineDistanceKm(start, item) <= NEARBY_PREFECTURE_LIMIT_KM,
      );
    }
    const next = pickPrefecture(direction, start, pool);
    setPrefecture(next);
    setFilterNotice(null);
    setStage("prefecture");
  }

  // Fetch candidates and turn them into feasible plans. On an empty result,
  // shows the appropriate notice and returns null.
  async function buildPlans(): Promise<{
    plans: Plan[];
    providerMock: boolean;
    placesNotice?: string;
  } | null> {
    if (!prefecture) return null;
    setNotice(null);
    setFilterNotice(null);

    const places = await getAttractionsByPrefecture(prefecture, selectedCategories);
    // Drop places the community disliked (and ones you 👎'd yourself).
    const excluded = await getExcludedPlaceIds(user?.uid);
    const candidates = places.data.filter((place) => !excluded.has(place.id));

    if (!candidates.length) {
      setFilterNotice(
        "選んだジャンルに合う場所が見つかりませんでした。ジャンルを変えるか、メインに戻って別の方角を試してみてね。",
      );
      setFiltersOpen(true);
      setStage("prefecture");
      return null;
    }

    let plans: Plan[];
    if (journeyMode === "custom") {
      const usableModes: TransportMode[] = transports.length
        ? transports
        : ["train"];
      plans = [];
      for (const candidate of candidates) {
        const distance = haversineDistanceKm(start, candidate);
        if (distance > maxDistance) continue;
        const best = bestTransport({
          distanceKm: distance,
          categories: candidate.categories,
          people,
          modes: usableModes,
          transfer: allowTransfer,
          maxBudget: budget,
          maxOneWayMinutes,
        });
        if (!best) continue;
        plans.push({ destination: candidate, transport: best.mode });
      }

      if (!plans.length) {
        setFilterNotice(
          "設定した条件に合う場所が見つかりませんでした。下の設定で予算・距離・時間・移動手段をゆるめて、もう一度さがしてみてね。",
        );
        setSettingsOpen(true);
        setStage("prefecture");
        return null;
      }
    } else {
      plans = candidates.map((candidate) => ({
        destination: candidate,
        transport: "train" as TransportMode,
      }));
    }

    return {
      plans,
      providerMock: places.provider === "mock",
      placesNotice: places.notice,
    };
  }

  // The loading → result flow for one chosen plan.
  async function finalizePlan(
    plan: Plan,
    providerMock: boolean,
    placesNotice?: string,
  ) {
    if (!direction || !prefecture) return;
    setStage("loading");
    setRevealTarget({
      latitude: plan.destination.latitude,
      longitude: plan.destination.longitude,
      name: plan.destination.name,
      prefecture: prefecture.nameJa,
    });
    const landed = new Promise<void>((resolve) => {
      revealLanded.current = resolve;
    });
    const startedAt = nowMs();
    const picked = plan.destination;
    const transport = plan.transport;
    const transfer = journeyMode === "custom" ? allowTransfer : false;

    const [weather, summary, gallery, commons, openverse] = await Promise.all([
      getWeatherByCoordinates(picked.latitude, picked.longitude),
      getDestinationSummary(picked.name),
      getDestinationImages(picked.name),
      searchCommonsPhotos(`${picked.name} ${prefecture.nameJa}`),
      getOpenversePhotos(`${picked.name} ${prefecture.nameJa}`),
    ]);
    // Lead with the article's hero image (unless it's a location/relief map,
    // common on small-place articles), then merge Wikimedia + Openverse photos.
    const candidateHero = summary?.imageUrl ?? picked.imageUrl;
    let images = mergePhotos(
      [
        candidateHero && looksLikePhoto(candidateHero) ? [candidateHero] : [],
        gallery,
        commons,
        openverse,
      ],
      12,
    );
    if (!images.length) {
      // No usable photo anywhere: fall back to photos near the coordinates.
      images = await getNearbyPhotos(picked.latitude, picked.longitude);
    }
    const heroImage = images[0];
    const destination = {
      ...picked,
      description: summary?.description ?? picked.description,
      imageUrl: heroImage,
      images,
    };
    const travel = estimateTravelTime(destination, start, transport, transfer);
    const budgetResult = estimateBudget(
      travel.distanceKm,
      destination.categories,
      people,
      transport,
      transfer,
    );
    // Hold the result until the Japan → place fly-in has landed (plus a beat
    // to see the pin + name), but never longer than ~7s in total.
    const pause = (ms: number) =>
      new Promise<void>((resolve) => window.setTimeout(resolve, ms));
    await Promise.race([
      landed.then(() => pause(1100)),
      pause(Math.max(0, 7000 - (nowMs() - startedAt))),
    ]);
    revealLanded.current = null;

    const result: JourneyResult = {
      id: makeJourneyId(destination.id),
      createdAt: nowIso(),
      direction,
      start,
      prefecture,
      destination,
      weather: weather.data,
      estimatedBudget: budgetResult,
      estimatedTravelTime: travel.minutes,
      distanceKm: travel.distanceKm,
      people,
      transport,
      transfer,
      isMock: providerMock || weather.provider === "mock",
    };
    setJourney(result);
    setSavedJourneyId(null);
    setShareFeedback(false);
    setAiText(null);
    setAiPlan(null);
    setNotice([placesNotice, weather.notice].filter(Boolean).join(" "));
    setStage("result");

    // Keep a short history of the last few generated places: locally always,
    // and synced to the account when signed in.
    pushRecentJourney(result);
    if (user) {
      const base = cloudRecent ?? [];
      const nextRecent = [
        result,
        ...base.filter((item) => item.id !== result.id),
      ].slice(0, 5);
      setCloudRecent(nextRecent);
      saveRecentForUser(user.uid, nextRecent).catch(() => {});
    }
  }

  async function chooseDestination() {
    if (!direction || !prefecture) return;
    const built = await buildPlans();
    if (!built) return;

    // When re-rolling, avoid showing the same place twice in a row.
    let pool = built.plans;
    if (journey && pool.length > 1) {
      const others = pool.filter(
        (plan) => plan.destination.id !== journey.destination.id,
      );
      if (others.length) pool = others;
    }

    // With an explicit genre filter, pick freely within it; otherwise bias
    // toward the traveller's saved favourites (and the season).
    const picked = selectedCategories.length
      ? randomItem(pool)
      : pickPlanWithBoost(pool, readPreferences());
    await finalizePlan(picked, built.providerMock, built.placesNotice);
  }

  // Shuffle mode: deal a hand of candidate cards and let the user pick one.
  async function startShuffle() {
    if (!direction || !prefecture) return;
    const built = await buildPlans();
    if (!built) return;
    setShufflePool(built);
    setShuffleOptions(
      sampleWithPreference(built.plans, SHUFFLE_COUNT, readPreferences()),
    );
    setStage("shuffle");
  }

  function reshuffle() {
    if (!shufflePool) return;
    setShuffleOptions((current) => {
      const shown = new Set(current.map((plan) => plan.destination.id));
      const fresh = shufflePool.plans.filter(
        (plan) => !shown.has(plan.destination.id),
      );
      // Prefer unseen places; top up from the full pool when running low.
      const next = sampleItems(fresh, SHUFFLE_COUNT);
      if (next.length < SHUFFLE_COUNT) {
        const rest = shufflePool.plans.filter(
          (plan) => !next.some((p) => p.destination.id === plan.destination.id),
        );
        next.push(...sampleItems(rest, SHUFFLE_COUNT - next.length));
      }
      return next;
    });
  }

  function chooseShuffleOption(plan: Plan) {
    if (!shufflePool) return;
    void finalizePlan(plan, shufflePool.providerMock, shufflePool.placesNotice);
  }

  async function handleAskAi() {
    if (!journey || aiLoading) return;
    setAiLoading(true);
    setAiText(null);
    try {
      const response = await fetch("/api/place-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: journey.destination.name,
          prefecture: journey.prefecture.nameJa,
          categories: journey.destination.categories,
        }),
      });
      const data = await response.json();
      setAiText(
        response.ok && data.text
          ? (data.text as string)
          : "AIの情報を取得できませんでした。少し時間をおいて試してみてね。",
      );
    } catch {
      setAiText("AIの情報を取得できませんでした。少し時間をおいて試してみてね。");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSaveCurrent() {
    if (!user || !journey) return;
    setSavedJourneyId(journey.id);
    try {
      await saveJourneyForUser(user.uid, journey);
    } catch {
      setSavedJourneyId(null); // saving failed — let the user retry
    }
  }

  function viewRecent(item: JourneyResult) {
    setDirection(item.direction);
    setPrefecture(item.prefecture);
    setJourney(item);
    setSavedJourneyId(null);
    setShareFeedback(false);
    setAiText(null);
    setAiPlan(null);
    setNotice(null);
    setFilterNotice(null);
    setStage("result");
  }

  async function handleCopyLink() {
    if (!journey) return;
    const url = `${window.location.origin}/trip?d=${encodeTrip(journey)}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // clipboard blocked — nothing to do
    }
  }

  async function handleShare() {
    if (!journey) return;
    const mapsUrl = googleMapsSearchUrl(journey.destination);
    const text = [
      `Dokoniikuのタビが選んだ行き先: ${journey.destination.name}（${journey.prefecture.nameJa}）`,
      `${journey.start.name}から約${journey.distanceKm}km ・ ${transportLabel(journey.transport, journey.transfer)}で片道${formatMinutes(journey.estimatedTravelTime)}`,
      `地図: ${mapsUrl}`,
    ].join("\n");
    const title = `Dokoniiku | ${journey.destination.name}`;

    try {
      // Pretty share card: photo + name + mascot + brand.
      const blob = await buildShareCard(journey).catch(() => null);
      const file = blob
        ? new File([blob], "dokoniiku.png", { type: "image/png" })
        : null;

      // Mobile with image support: share the card itself.
      if (
        file &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] }) &&
        typeof navigator.share === "function"
      ) {
        await navigator.share({ files: [file], title, text });
        return;
      }
      // Mobile without file sharing: plain share sheet.
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text, url: window.location.origin });
        return;
      }
      // Desktop: download the card and copy the text.
      if (blob) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `dokoniiku-${journey.destination.name}.png`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 5000);
      }
      await navigator.clipboard.writeText(`${text}\n${window.location.origin}`);
      setShareFeedback(true);
      window.setTimeout(() => setShareFeedback(false), 2600);
    } catch {
      // user cancelled the share sheet — nothing to do
    }
  }

  async function handleAskPlan() {
    if (!journey || aiPlanLoading) return;
    setAiPlanLoading(true);
    setAiPlan(null);
    try {
      const response = await fetch("/api/place-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "plan",
          name: journey.destination.name,
          prefecture: journey.prefecture.nameJa,
          categories: journey.destination.categories,
          weather: journey.weather.description,
          temperature: journey.weather.temperature,
          transport: transportLabel(journey.transport, journey.transfer),
          travelMinutes: journey.estimatedTravelTime,
        }),
      });
      const data = await response.json();
      setAiPlan(
        response.ok && data.text
          ? (data.text as string)
          : "プランを作れませんでした。少し時間をおいて試してみてね。",
      );
    } catch {
      setAiPlan("プランを作れませんでした。少し時間をおいて試してみてね。");
    } finally {
      setAiPlanLoading(false);
    }
  }

  const filtersActive = selectedCategories.length > 0;

  const filterPanel = (
    <div className="mt-6 border-t border-[color:var(--line)] pt-6">
      <button
        type="button"
        onClick={() => setFiltersOpen((open) => !open)}
        className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-2 text-xs font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
      >
        <SlidersHorizontal size={14} />
        ジャンルで絞る（任意）
        {filtersActive && (
          <span className="rounded-full bg-vermilion px-1.5 py-0.5 text-[10px] font-black text-white">
            {selectedCategories.length}件
          </span>
        )}
      </button>

      <ExpandPanel open={filtersOpen}>
        <div className="mt-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[color:var(--foreground)]">
                気になるジャンル
              </p>
              <p className="mt-0.5 text-xs font-medium text-[color:var(--muted)]">
                複数選択できます・未選択ならタビにおまかせ
              </p>
            </div>
            {filtersActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-[color:var(--muted)] transition hover:bg-[color:var(--surface)] hover:text-[color:var(--foreground)]"
              >
                <RotateCcw size={12} />
                クリア
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {CATEGORY_ORDER.map((category) => (
              <CategoryCard
                key={category}
                category={category}
                selected={selectedCategories.includes(category)}
                onClick={() => toggleCategory(category)}
              />
            ))}
          </div>
        </div>
      </ExpandPanel>
    </div>
  );

  // Budget / time / distance / transport knobs. Shared between the landing
  // custom mode and the "loosen your settings" panel on the prefecture stage.
  const customKnobs = (
    <div className="space-y-3 text-left">
      <KnobCard
        icon={WalletCards}
        title={`予算（${people}名・上限）`}
        value={formatYen(budget)}
      >
        <input
          type="range"
          min={BUDGET_MIN}
          max={budgetMax}
          step={1000}
          value={budget}
          onChange={(event) => setBudget(Number(event.target.value))}
          className="range-brand"
          style={
            {
              "--fill": `${sliderFill(budget, BUDGET_MIN, budgetMax)}%`,
            } as React.CSSProperties
          }
        />
        <div className="mt-1 flex justify-between text-[10px] font-bold text-[color:var(--muted)]">
          <span>{formatYen(BUDGET_MIN)}</span>
          <span>{formatYen(budgetMax)}</span>
        </div>
      </KnobCard>

      <KnobCard icon={CalendarDays} title="旅の日数">
        <div className="grid grid-cols-3 gap-2">
          {tripLengthOptions.map((option) => {
            const Icon = tripLengthIcons[option.id];
            const active = tripLength === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => setTripLength(option.id)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-bold transition ${
                  active
                    ? "border-vermilion bg-vermilion/10 text-vermilion"
                    : "border-[color:var(--line)] bg-[color:var(--surface-muted)] text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                }`}
              >
                <Icon size={18} />
                {option.labelJa}
                <span className="text-[10px] font-medium opacity-70">
                  片道〜{Math.round(option.maxOneWayMinutes / 60)}h
                </span>
              </button>
            );
          })}
        </div>
      </KnobCard>

      <KnobCard
        icon={Route}
        title="出発地からの距離（上限）"
        value={`約${maxDistance}km`}
      >
        <input
          type="range"
          min={5}
          max={DISTANCE_MAX}
          step={5}
          value={maxDistance}
          onChange={(event) => setMaxDistance(Number(event.target.value))}
          className="range-brand"
          style={
            {
              "--fill": `${sliderFill(maxDistance, 5, DISTANCE_MAX)}%`,
            } as React.CSSProperties
          }
        />
        <div className="mt-1 flex justify-between text-[10px] font-bold text-[color:var(--muted)]">
          <span>5km</span>
          <span>{DISTANCE_MAX}km</span>
        </div>
      </KnobCard>

      <KnobCard icon={TrainFront} title="移動手段（複数選択可）">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {allTransportModes.map((mode) => {
            const Icon = transportIcons[mode];
            const active = transports.includes(mode);
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={active}
                onClick={() => toggleTransport(mode)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 text-[11px] font-bold transition ${
                  active
                    ? "border-vermilion bg-vermilion/10 text-vermilion"
                    : "border-[color:var(--line)] bg-[color:var(--surface-muted)] text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                }`}
              >
                <span
                  className={`grid h-9 w-9 place-items-center rounded-full transition ${
                    active
                      ? "bg-vermilion text-white"
                      : "bg-[color:var(--surface)] text-[color:var(--foreground)]"
                  }`}
                >
                  <Icon size={17} />
                </span>
                {transportInfo[mode].labelJa}
              </button>
            );
          })}
        </div>
      </KnobCard>

      <KnobCard icon={Ticket} title="乗り継ぎ（タクシー等）">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-[color:var(--muted)]">
            鉄道の旅にラストワンマイルのタクシーを許可します
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={allowTransfer}
            aria-label="乗り継ぎを許可"
            onClick={() => setAllowTransfer((value) => !value)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${
              allowTransfer ? "bg-vermilion" : "bg-[color:var(--line)]"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                allowTransfer ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </KnobCard>
    </div>
  );

  return (
    <AnimatePresence mode="wait">
      {stage === "landing" && (
        <motion.section
          key="landing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: -16 }}
          className="hero-image relative flex min-h-[calc(100vh-4rem)] items-center overflow-hidden pt-16"
        >
          <motion.div
            variants={staggerParent}
            initial="hidden"
            animate="show"
            className="mx-auto flex w-full max-w-2xl flex-col items-center px-5 py-12 text-center sm:px-6 md:py-20"
          >
            <motion.div
              variants={fadeUp}
              className="relative mb-2 flex justify-center"
            >
              <span className="pointer-events-none absolute inset-0 -z-10 mx-auto h-40 w-40 rounded-full bg-sun/20 blur-3xl" />
              <TabiMascot mood="idle" />
            </motion.div>
            <motion.div
              variants={fadeUp}
              className="mb-4 flex items-center justify-center gap-2 text-sm font-bold text-forest dark:text-forest-ink"
            >
              <span className="h-px w-8 bg-current" />
              WEEKEND TRIP SELECTOR
              <span className="h-px w-8 bg-current" />
            </motion.div>
            <motion.h1
              variants={fadeUp}
              className="text-5xl font-black leading-[1.08] text-[color:var(--foreground)] sm:text-6xl"
            >
              旅コンパス
              <span className="mt-3 block text-xl font-semibold text-[color:var(--muted)] sm:text-2xl">
                Dokoniiku
              </span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mt-6 max-w-md text-base font-medium leading-8 text-[color:var(--muted)] sm:text-lg"
            >
              次の休日、どこへ行く？
              <br />
              旅の精タビに、方角から目的地まで任せよう。
            </motion.p>
            <motion.div
              variants={fadeUp}
              className="mt-8 w-full sm:w-auto"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <motion.div
                animate={reduceMotion ? undefined : { scale: [1, 1.02, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <ActionButton
                  onClick={beginDirectionSelection}
                  icon={<Sparkles size={18} />}
                  className="w-full shadow-float sm:w-auto"
                >
                  旅をはじめる
                </ActionButton>
              </motion.div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="mt-6 flex w-full flex-col items-center gap-3"
            >
              <button
                type="button"
                onClick={() => setStartPickerOpen((open) => !open)}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-2 text-xs font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
              >
                <MapPin size={14} />
                出発地点: {start.name}
              </button>

              <ExpandPanel open={startPickerOpen} className="max-w-md">
                <div className="w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-4">
                  <button
                    type="button"
                    onClick={useCurrentLocation}
                    disabled={locating}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-forest/10 px-4 py-2.5 text-sm font-bold text-forest transition hover:bg-forest/15 disabled:opacity-60 dark:bg-forest-ink/10 dark:text-forest-ink"
                  >
                    <LocateFixed size={16} />
                    {locating ? "現在地を取得中…" : "現在地を使う"}
                  </button>
                  {locationError && (
                    <p className="mt-2 text-xs font-medium text-[color:var(--brand-ink)]">
                      {locationError}
                    </p>
                  )}
                  <p className="mt-4 text-xs font-bold text-[color:var(--muted)]">
                    またはリストから選ぶ
                  </p>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {startPointPresets.map((point) => (
                      <button
                        key={point.name}
                        type="button"
                        onClick={() => chooseStart(point)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                          start.name === point.name
                            ? "border-vermilion bg-vermilion/10 text-vermilion"
                            : "border-[color:var(--line)] text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                        }`}
                      >
                        {point.name}
                      </button>
                    ))}
                  </div>
                </div>
              </ExpandPanel>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-4 w-full max-w-md">
              <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-float">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-xs font-bold text-[color:var(--muted)]">
                    <Users size={15} /> 人数
                  </span>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: Math.min(people, 6) }).map((_, i) => (
                      <motion.span
                        key={i}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="h-2 w-2 rounded-full bg-vermilion"
                      />
                    ))}
                    {people > 6 && (
                      <span className="text-[10px] font-black text-vermilion">
                        +{people - 6}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-center gap-6">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.85 }}
                    onClick={() => setPeople((n) => Math.max(1, n - 1))}
                    disabled={people <= 1}
                    aria-label="人数を減らす"
                    className="grid h-11 w-11 place-items-center rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] text-xl font-black text-[color:var(--foreground)] transition hover:border-vermilion hover:text-vermilion disabled:opacity-40"
                  >
                    −
                  </motion.button>
                  <div className="flex min-w-[3.5rem] flex-col items-center">
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={people}
                        initial={{ y: 8, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -8, opacity: 0 }}
                        className="text-4xl font-black tabular-nums text-[color:var(--foreground)]"
                      >
                        {people}
                      </motion.span>
                    </AnimatePresence>
                    <span className="text-[11px] font-bold text-[color:var(--muted)]">
                      名
                    </span>
                  </div>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.85 }}
                    onClick={() => setPeople((n) => Math.min(20, n + 1))}
                    disabled={people >= 20}
                    aria-label="人数を増やす"
                    className="grid h-11 w-11 place-items-center rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] text-xl font-black text-[color:var(--foreground)] transition hover:border-vermilion hover:text-vermilion disabled:opacity-40"
                  >
                    +
                  </motion.button>
                </div>

              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-8 w-full max-w-md">
              <p className="mb-2 text-left text-xs font-bold text-[color:var(--muted)]">
                さがし方
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ChoiceCard
                  active={journeyMode === "surprise"}
                  onClick={() => setJourneyMode("surprise")}
                  visual={
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src="/mascot/camera.png"
                      alt=""
                      className="h-12 w-12 object-contain"
                    />
                  }
                  title="驚かせて"
                  subtitle="タビにおまかせ"
                />
                <ChoiceCard
                  active={journeyMode === "custom"}
                  onClick={() => setJourneyMode("custom")}
                  visual={
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src="/mascot/map.png"
                      alt=""
                      className="h-12 w-12 object-contain"
                    />
                  }
                  title="設定して探す"
                  subtitle="予算・距離で絞る"
                />
              </div>
            </motion.div>

            {journeyMode === "surprise" ? (
              <motion.div
                key="surprise-settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex w-full flex-col items-center"
              >
                <div className="mt-4 grid w-full max-w-md gap-3 sm:grid-cols-2">
                  <ChoiceCard
                    active={scope === "nearby"}
                    onClick={() => setScope("nearby")}
                    visual={<Footprints size={26} />}
                    title="近場で探す"
                    subtitle="日帰りで行ける範囲"
                  />
                  <ChoiceCard
                    active={scope === "all"}
                    onClick={() => setScope("all")}
                    visual={<Globe size={26} />}
                    title="全国から探す"
                    subtitle="47都道府県から"
                  />
                </div>
                <p className="mt-4 text-xs font-medium text-[color:var(--muted)]">
                  {scope === "nearby"
                    ? "出発地から日帰りで行ける範囲で、行き先をランダムに提案します"
                    : "全国47都道府県から、行き先をランダムに提案します"}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="custom-settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex w-full flex-col items-center"
              >
                <div className="mt-4 w-full max-w-md">{customKnobs}</div>
                <p className="mt-4 text-xs font-medium text-[color:var(--muted)]">
                  予算・時間・距離・移動手段に合う行き先だけを提案します
                </p>
              </motion.div>
            )}

            {recentJourneys.length > 0 && (
              <motion.div variants={fadeUp} className="mt-8 w-full max-w-md text-left">
                <p className="text-xs font-bold text-[color:var(--muted)]">
                  最近の行き先
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {recentJourneys.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => viewRecent(item)}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-2.5 text-left transition hover:border-vermilion/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">
                          {item.destination.name}
                        </span>
                        <span className="block text-xs text-[color:var(--muted)]">
                          {item.prefecture.nameJa} ・ {item.distanceKm}km
                        </span>
                      </span>
                      <ChevronRight
                        size={16}
                        className="shrink-0 text-[color:var(--muted)]"
                      />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.section>
      )}

      {stage === "direction" && (
        <motion.section
          key="direction"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col justify-center px-5 py-24 sm:px-6"
        >
          <div className="mt-12 grid items-center gap-10 md:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="relative mx-auto grid h-72 w-72 place-items-center"
            >
              <div className="absolute inset-0 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] shadow-float" />
              {directions.map((item) => {
                const angle = directionAngles[item];
                return (
                  <span
                    key={item}
                    className={`absolute text-sm font-bold transition ${
                      direction === item
                        ? "text-vermilion"
                        : "text-[color:var(--muted)]"
                    }`}
                    style={{
                      transform: `rotate(${angle}deg) translateY(-116px) rotate(-${angle}deg)`,
                    }}
                  >
                    {item}
                  </span>
                );
              })}
              <motion.div
                animate={
                  selecting
                    ? { rotate: 1080 }
                    : { rotate: direction ? directionAngles[direction] : 0 }
                }
                transition={{
                  duration: selecting ? 1.35 : 0.5,
                  ease: selecting ? "easeInOut" : "backOut",
                }}
                className="absolute bottom-1/2 left-1/2 h-20 w-2 -ml-1 origin-bottom rounded-full bg-vermilion"
              >
                <span className="absolute -left-2 -top-2 h-5 w-5 rotate-45 bg-vermilion" />
              </motion.div>
              <div className="z-10 grid h-16 w-16 place-items-center rounded-full border-4 border-[color:var(--surface)] bg-forest text-white shadow-lg">
                <Sparkles size={22} />
              </div>
            </motion.div>

            <div className="text-center md:text-left">
              <div className="flex justify-center md:justify-start">
                <TabiMascot
                  mood={selecting ? "thinking" : "reveal"}
                  size="medium"
                />
              </div>
              <p className="mt-5 text-sm font-bold text-vermilion">
                STEP 01 / DIRECTION
              </p>
              <h2 className="mt-2 text-3xl font-black sm:text-4xl">
                {selecting
                  ? "タビが風を読んでいます…"
                  : `今日は「${direction}」へ！`}
              </h2>
              <p className="mt-4 leading-7 text-[color:var(--muted)]">
                {selecting
                  ? "どの方角になるかは、タビだけが知っています。"
                  : "この先にある都道府県から、次の行き先を選びます。"}
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <ActionButton
                  onClick={choosePrefecture}
                  disabled={selecting || !direction}
                  icon={<ArrowRight size={18} />}
                  className="w-full sm:w-auto"
                >
                  この方角へ進む
                </ActionButton>
                <ActionButton
                  variant="secondary"
                  onClick={beginDirectionSelection}
                  disabled={selecting}
                  icon={
                    <motion.span
                      className="inline-flex"
                      animate={selecting ? { rotate: -360 } : { rotate: 0 }}
                      transition={{
                        duration: 1,
                        repeat: selecting ? Infinity : 0,
                        ease: "linear",
                      }}
                    >
                      <RotateCcw size={17} />
                    </motion.span>
                  }
                  className="w-full sm:w-auto"
                >
                  {selecting ? "回しています…" : "もう一度回す"}
                </ActionButton>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {stage === "prefecture" && prefecture && (
        <motion.section
          key="prefecture"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl flex-col justify-center px-5 py-24 sm:px-6"
        >
          <div className="mt-10 overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-float sm:p-10">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-bold text-vermilion">
                STEP 02 / PREFECTURE
              </p>
              <span
                className="rounded-full px-3 py-1 text-xs font-bold text-white"
                style={{ backgroundColor: prefecture.accent }}
              >
                {prefecture.region}
              </span>
            </div>
            <div className="mt-8 flex items-end gap-3">
              <h2 className="text-4xl font-black sm:text-5xl">{prefecture.nameJa}</h2>
              <p className="pb-1 text-sm font-bold text-[color:var(--muted)]">
                {prefecture.nameEn}
              </p>
            </div>
            <p className="mt-5 max-w-md text-base font-medium leading-8 text-[color:var(--muted)]">
              {prefecture.shortDescriptionJa}
            </p>
            <div className="mt-8 flex items-center gap-4 border-t border-[color:var(--line)] pt-6">
              <TabiMascot mood="reveal" size="medium" />
              <p className="text-sm font-medium leading-7">
                「{direction}」の風が、ここまで連れてきたよ。
                <br />
                次は本当の目的地を探そう。
              </p>
            </div>

            {filterPanel}

            {filterNotice && (
              <div className="mt-5 flex items-start gap-2 rounded-lg border border-vermilion/40 bg-vermilion/10 px-4 py-3 text-xs font-medium leading-5">
                <Info size={16} className="mt-0.5 shrink-0 text-vermilion" />
                <span>{filterNotice}</span>
              </div>
            )}

            {journeyMode === "custom" && (
              <div className="mt-6 border-t border-[color:var(--line)] pt-6">
                <button
                  type="button"
                  onClick={() => setSettingsOpen((open) => !open)}
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-2 text-xs font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
                >
                  <SlidersHorizontal size={14} />
                  予算・距離・時間・移動手段を調整
                </button>
                <ExpandPanel open={settingsOpen}>
                  <div className="mt-3">{customKnobs}</div>
                </ExpandPanel>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ActionButton
                onClick={chooseDestination}
                icon={<Sparkles size={18} />}
                className="w-full sm:w-auto"
              >
                目的地を決める
              </ActionButton>
              <ActionButton
                variant="ghost"
                onClick={startShuffle}
                icon={<Shuffle size={17} />}
                className="w-full sm:w-auto"
              >
                4つの候補から選ぶ
              </ActionButton>
            </div>
            <button
              type="button"
              onClick={returnToStart}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
            >
              <House size={13} />
              メインに戻る
            </button>
          </div>
        </motion.section>
      )}

      {stage === "shuffle" && prefecture && (
        <motion.section
          key="shuffle"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          className="mx-auto min-h-[calc(100vh-4rem)] max-w-3xl px-5 py-24 sm:px-6"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-vermilion">
                SHUFFLE / {prefecture.nameJa}
              </p>
              <h2 className="mt-2 text-3xl font-black sm:text-4xl">
                気になる場所をひとつ選ぼう
              </h2>
              <p className="mt-2 text-sm font-medium text-[color:var(--muted)]">
                タビが{prefecture.nameJa}から4つの候補を引いてきたよ。
              </p>
            </div>
            <TabiMascot mood="thinking" size="small" />
          </div>

          <div className="mt-6 h-64 overflow-hidden rounded-2xl border border-[color:var(--line)] shadow-float sm:h-80">
            <ShuffleMap
              points={shufflePoints}
              activeId={shuffleHover}
              onHover={setShuffleHover}
              onPick={(id) => {
                const plan = shuffleOptions.find((p) => p.destination.id === id);
                if (plan) chooseShuffleOption(plan);
              }}
            />
          </div>
          <p className="mt-2 text-center text-xs font-bold text-[color:var(--muted)]">
            地図のピンをタップしても選べるよ
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {shuffleOptions.map((plan, index) => {
              const distanceKm = haversineDistanceKm(start, plan.destination);
              const difficulty = journeyDifficulty(distanceKm);
              return (
                <motion.button
                  key={plan.destination.id}
                  type="button"
                  onClick={() => chooseShuffleOption(plan)}
                  onMouseEnter={() => setShuffleHover(plan.destination.id)}
                  onMouseLeave={() => setShuffleHover(null)}
                  initial={{ opacity: 0, y: 24, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: index * 0.08, type: "spring", stiffness: 260, damping: 22 }}
                  whileHover={{ y: -6, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`group overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] text-left shadow-float transition hover:border-vermilion/60 ${difficultyFrameClass(difficulty)}`}
                >
                  <div className="relative h-32 overflow-hidden bg-forest/10">
                    {plan.destination.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={plan.destination.imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-forest-ink/50 dark:text-forest-ink/50">
                        <MapPin size={32} />
                      </div>
                    )}
                    <DifficultyBadge
                      difficulty={difficulty}
                      className="absolute right-2 top-2 shadow-sm"
                    />
                    <span
                      className={`absolute left-2 top-2 grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-vermilion text-sm font-black text-white shadow transition ${
                        shuffleHover === plan.destination.id ? "scale-110" : ""
                      }`}
                    >
                      {index + 1}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-black leading-snug">
                      {plan.destination.name}
                    </h3>
                    <p className="mt-1 text-xs font-bold text-[color:var(--muted)]">
                      {start.name}から約{distanceKm}km ・{" "}
                      {transportLabel(
                        plan.transport,
                        journeyMode === "custom" ? allowTransfer : false,
                      )}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {plan.destination.categories.slice(0, 2).map((category) => (
                        <span
                          key={category}
                          className="rounded-full bg-forest/10 px-2.5 py-1 text-[11px] font-bold text-forest dark:bg-forest-ink/10 dark:text-forest-ink"
                        >
                          {categoryLabels[category]}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-[color:var(--line)] pt-6 sm:flex-row">
            <p className="text-sm font-medium text-[color:var(--muted)]">
              ピンとこない？ 別の4つを引き直せるよ。
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <ActionButton
                variant="ghost"
                onClick={reshuffle}
                icon={<Shuffle size={17} />}
              >
                引き直す
              </ActionButton>
              <button
                type="button"
                onClick={returnToStart}
                className="inline-flex items-center justify-center gap-1.5 text-sm font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
              >
                <House size={15} />
                最初からやり直す
              </button>
            </div>
          </div>
        </motion.section>
      )}

      {stage === "loading" && (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {revealTarget ? (
            <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col px-4 pb-10 pt-24 sm:px-6">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-vermilion">
                    TABI&apos;S PICK / {revealTarget.prefecture}
                  </p>
                  <motion.h2
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 2.6 }}
                    className="mt-1 truncate font-display text-3xl font-black sm:text-4xl"
                  >
                    {revealTarget.name}
                  </motion.h2>
                </div>
                <TabiMascot mood="walking" size="small" />
              </div>
              <div className="mt-4 h-[56vh] min-h-72 w-full overflow-hidden rounded-2xl border border-[color:var(--line)] shadow-float">
                <RevealMap
                  latitude={revealTarget.latitude}
                  longitude={revealTarget.longitude}
                  name={revealTarget.name}
                  onLanded={() => revealLanded.current?.()}
                />
              </div>
              <p className="mt-3 text-center text-sm font-bold text-[color:var(--muted)]">
                タビが目的地へ案内中… 天気と写真も集めています
              </p>
            </section>
          ) : (
            <>
              <div className="fixed inset-x-0 top-24 z-10 flex justify-center">
                <TabiMascot mood="walking" size="small" />
              </div>
              <JourneySkeleton />
            </>
          )}
        </motion.div>
      )}

      {stage === "result" && journey && (
        <motion.section
          key="result"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto min-h-[calc(100vh-4rem)] max-w-6xl px-4 py-24 sm:px-6"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-vermilion">
                TABI&apos;S PICK / 週末の行き先
              </p>
              <h2 className="mt-2 text-3xl font-black sm:text-5xl">
                {journey.destination.name}
              </h2>
              <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-[color:var(--muted)]">
                <MapPin size={16} />
                {journey.prefecture.nameJa} ・ {journey.distanceKm}km
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <DifficultyBadge
                difficulty={journeyDifficulty(
                  journey.distanceKm,
                  journey.estimatedTravelTime,
                )}
              />
              {isSeasonalMatch(journey.destination.categories) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sun/20 px-3 py-1.5 text-xs font-bold text-[#816106] dark:text-sun">
                  {seasonInfo[CURRENT_SEASON].emoji}{" "}
                  {seasonInfo[CURRENT_SEASON].labelJa}のおすすめ
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-vermilion/10 px-3 py-1.5 text-xs font-bold text-vermilion">
                <TransportIcon mode={journey.transport} size={14} />
                {transportLabel(journey.transport, journey.transfer)}
              </span>
              {journey.destination.categories.map((category) => (
                <span
                  key={category}
                  className="rounded-full bg-forest/10 px-3 py-1.5 text-xs font-bold text-forest dark:bg-forest-ink/10 dark:text-forest-ink"
                >
                  {categoryLabels[category]}
                </span>
              ))}
            </div>
          </div>

          {notice && (
            <div className="mt-5 flex items-start gap-2 rounded-lg border border-sun/40 bg-sun/10 px-4 py-3 text-xs font-medium leading-5">
              <Info size={16} className="mt-0.5 shrink-0 text-[#9b7418]" />
              <span>{notice}</span>
            </div>
          )}

          <motion.div
            variants={staggerParent}
            initial="hidden"
            animate="show"
            className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_.8fr]"
          >
            {/* On mobile every block is flattened into one column and reordered
                via `order-*` (weather/budget up, videos/map down); on desktop
                the two columns return via `lg:block`. */}
            <div className="contents lg:block lg:min-w-0 lg:space-y-6">
              <ImageGallery
                className="order-1 lg:order-none"
                images={
                  journey.destination.images?.length
                    ? journey.destination.images
                    : journey.destination.imageUrl
                      ? [journey.destination.imageUrl]
                      : []
                }
                alt={journey.destination.name}
                frameClass={difficultyFrameClass(
                  journeyDifficulty(
                    journey.distanceKm,
                    journey.estimatedTravelTime,
                  ),
                )}
              />
              <p className="order-1 px-1 text-[10px] leading-4 text-[color:var(--muted)] lg:order-none">
                写真:{" "}
                <a
                  href="https://commons.wikimedia.org"
                  target="_blank"
                  rel="noreferrer"
                  className="underline-offset-2 hover:underline"
                >
                  Wikimedia Commons
                </a>
                {" ・ "}
                <a
                  href="https://openverse.org"
                  target="_blank"
                  rel="noreferrer"
                  className="underline-offset-2 hover:underline"
                >
                  Openverse
                </a>
                （各画像の著作権は投稿者に帰属します）
              </p>

              <div className="order-2 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-6 lg:order-none">
                <h3 className="text-sm font-black">この場所について</h3>
                <p className="mt-3 text-sm font-medium leading-7 text-[color:var(--foreground)]">
                  {journey.destination.description}
                </p>

                {aiEnabled && (
                  <div className="mt-4 border-t border-[color:var(--line)] pt-4">
                    <div className="flex flex-wrap gap-2">
                      {!aiText && (
                        <button
                          type="button"
                          onClick={handleAskAi}
                          disabled={aiLoading}
                          className="inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-60"
                        >
                          <Sparkles size={14} />
                          {aiLoading ? "タビが調べています…" : "タビにAIでもっと聞く"}
                        </button>
                      )}
                      {!aiPlan && (
                        <button
                          type="button"
                          onClick={handleAskPlan}
                          disabled={aiPlanLoading}
                          className="inline-flex items-center gap-2 rounded-full border border-forest px-4 py-2 text-xs font-bold text-forest transition hover:bg-forest/10 disabled:opacity-60 dark:border-forest-ink dark:text-forest-ink"
                        >
                          <Ticket size={14} />
                          {aiPlanLoading ? "プランを考え中…" : "1日プランを作ってもらう"}
                        </button>
                      )}
                    </div>
                    {aiText && (
                      <div className="mt-3 flex items-start gap-2">
                        <Sparkles
                          size={16}
                          className="mt-0.5 shrink-0 text-forest dark:text-forest-ink"
                        />
                        <div>
                          <p className="text-xs font-bold text-[color:var(--muted)]">
                            タビのAIガイド
                          </p>
                          <p className="mt-1 text-sm font-medium leading-7 text-[color:var(--foreground)]">
                            {aiText}
                          </p>
                          <p className="mt-2 text-[10px] text-[color:var(--muted)]">
                            AIによる生成のため、内容が不正確な場合があります。
                          </p>
                        </div>
                      </div>
                    )}
                    {aiPlan && (
                      <div className="mt-3 flex items-start gap-2">
                        <Ticket
                          size={16}
                          className="mt-0.5 shrink-0 text-forest dark:text-forest-ink"
                        />
                        <div>
                          <p className="text-xs font-bold text-[color:var(--muted)]">
                            タビの1日プラン
                          </p>
                          <p className="mt-1 whitespace-pre-line text-sm font-medium leading-7 text-[color:var(--foreground)]">
                            {aiPlan}
                          </p>
                          <p className="mt-2 text-[10px] text-[color:var(--muted)]">
                            AIによる生成のため、営業時間などは事前に確認してね。
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {journey.destination.categories.includes("food") && (
                <MenuCard
                  key={`menu-${journey.destination.id}`}
                  className="order-2 lg:order-none"
                  name={journey.destination.name}
                  prefecture={journey.prefecture.nameJa}
                  latitude={journey.destination.latitude}
                  longitude={journey.destination.longitude}
                  aiEnabled={aiEnabled}
                />
              )}

              <FactsCard
                key={`facts-${journey.destination.id}`}
                className="order-9 lg:order-none"
                name={journey.destination.name}
                prefecture={journey.prefecture.nameJa}
                categories={journey.destination.categories}
                aiEnabled={aiEnabled}
              />

              <VideosCard
                key={`videos-${journey.destination.id}`}
                className="order-11 lg:order-none"
                name={journey.destination.name}
                prefecture={journey.prefecture.nameJa}
              />

              <NearbyCard
                key={`nearby-${journey.destination.id}`}
                className="order-10 lg:order-none"
                placeName={journey.destination.name}
                latitude={journey.destination.latitude}
                longitude={journey.destination.longitude}
              />

              <div className="order-12 min-w-0 overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] lg:order-none">
                <PlaceMap
                  key={journey.destination.id}
                  latitude={journey.destination.latitude}
                  longitude={journey.destination.longitude}
                  name={journey.destination.name}
                />
                <div className="flex items-center justify-between px-4 py-2 text-[10px] font-medium text-[color:var(--muted)]">
                  <span>周辺マップ</span>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${journey.destination.latitude}&mlon=${journey.destination.longitude}#map=14/${journey.destination.latitude}/${journey.destination.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline-offset-2 hover:underline"
                  >
                    © OpenStreetMap contributors
                  </a>
                </div>
              </div>

              <div className="order-12 flex flex-col gap-4 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5 sm:flex-row sm:items-center sm:justify-between lg:order-none">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-forest/10 text-forest dark:bg-forest-ink/10 dark:text-forest-ink">
                    <MapPin size={20} />
                  </span>
                  <div>
                    <p className="text-sm font-black">
                      {journey.destination.name}
                    </p>
                    <p className="text-xs font-medium text-[color:var(--muted)]">
                      {journey.prefecture.nameJa} ・ {journey.start.name}から約{journey.distanceKm}km
                    </p>
                  </div>
                </div>
                <a
                  href={googleMapsSearchUrl(journey.destination)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] px-5 text-sm font-bold transition hover:bg-[color:var(--surface-muted)]"
                >
                  Google Mapsで見る
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>

            <div className="contents lg:block lg:min-w-0 lg:space-y-4">
              <div className="order-3 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5 lg:order-none">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-[color:var(--muted)]">
                      {journey.weather.forDate
                        ? `${weatherDateLabel(journey.weather.forDate)}の予報`
                        : "現地の天気"}
                    </p>
                    <p className="mt-2 text-3xl font-black">
                      {journey.weather.temperature}℃
                    </p>
                    <p className="mt-1 text-sm font-bold">
                      {journey.weather.description}
                    </p>
                    {(journey.weather.high != null ||
                      journey.weather.precipitation != null) && (
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-bold text-[color:var(--muted)]">
                        {journey.weather.high != null &&
                          journey.weather.low != null && (
                            <span>
                              最高 {journey.weather.high}° / 最低{" "}
                              {journey.weather.low}°
                            </span>
                          )}
                        {journey.weather.precipitation != null && (
                          <span className="inline-flex items-center gap-1">
                            <CloudRain size={13} className="text-sky" />
                            {journey.weather.precipitation}%
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <WeatherIcon weather={journey.weather} />
                </div>
                <p className="mt-4 border-t border-[color:var(--line)] pt-4 text-xs font-medium leading-6 text-[color:var(--muted)]">
                  {journey.weather.advice}
                </p>
              </div>

              <div className="order-4 grid grid-cols-2 gap-4 lg:order-none">
                <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
                  <TransportIcon
                    mode={journey.transport}
                    className="text-forest dark:text-forest-ink"
                  />
                  <p className="mt-4 text-xs font-bold text-[color:var(--muted)]">
                    片道の所要時間
                  </p>
                  <p className="mt-1 text-lg font-black">
                    {formatMinutes(journey.estimatedTravelTime)}
                  </p>
                  <p className="mt-2 text-[10px] text-[color:var(--muted)]">
                    {transportLabel(journey.transport, journey.transfer)}での目安
                  </p>
                </div>
                <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
                  <WalletCards
                    size={21}
                    className="text-vermilion"
                  />
                  <p className="mt-4 text-xs font-bold text-[color:var(--muted)]">
                    予算の目安
                  </p>
                  <p className="mt-1 text-lg font-black">
                    {formatYen(journey.estimatedBudget.total)}
                  </p>
                  <p className="mt-2 text-[10px] text-[color:var(--muted)]">
                    {journey.people}名・日帰り合計
                    {journey.people > 1 &&
                      `（1名あたり約${formatYen(
                        Math.round(journey.estimatedBudget.total / journey.people),
                      )}）`}
                  </p>
                </div>
              </div>

              <div className="order-5 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5 lg:order-none">
                <h3 className="text-sm font-black">
                  費用の内訳
                  <span className="ml-1.5 text-xs font-bold text-[color:var(--muted)]">
                    （{journey.people}名分）
                  </span>
                </h3>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="flex items-center gap-2 text-[color:var(--muted)]">
                      <TrainFront size={16} /> 交通費（往復）
                    </dt>
                    <dd className="font-bold">
                      {formatYen(journey.estimatedBudget.transportCost)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="flex items-center gap-2 text-[color:var(--muted)]">
                      <Ticket size={16} /> 入場・体験
                    </dt>
                    <dd className="font-bold">
                      {formatYen(journey.estimatedBudget.activityCost)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="flex items-center gap-2 text-[color:var(--muted)]">
                      <Utensils size={16} /> 食事
                    </dt>
                    <dd className="font-bold">
                      {formatYen(journey.estimatedBudget.foodCost)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 text-[10px] text-[color:var(--muted)]">
                  費用は距離とカテゴリから算出した目安です。実際の料金を保証するものではありません。
                </p>
              </div>

              <div className="order-6 flex items-start gap-3 rounded-lg bg-forest p-5 text-white lg:order-none">
                <TabiMascot mood="excited" size="small" />
                <div className="pt-3">
                  <p className="text-xs font-bold text-white/80">
                    タビのおすすめ理由
                  </p>
                  <p className="mt-2 text-sm font-bold leading-6">
                    {randomItem(reasonTexts)}
                  </p>
                </div>
              </div>

              <PlaceRating
                key={`rating-${journey.destination.id}`}
                className="order-6 lg:order-none"
                placeId={journey.destination.id}
                name={journey.destination.name}
                prefecture={journey.prefecture.nameJa}
              />

              {authEnabled &&
                (user ? (
                  <ActionButton
                    onClick={handleSaveCurrent}
                    icon={
                      savedJourneyId === journey.id ? (
                        <Check size={18} />
                      ) : (
                        <Bookmark size={18} />
                      )
                    }
                    className="order-7 w-full lg:order-none"
                  >
                    {savedJourneyId === journey.id
                      ? "保存しました"
                      : "この旅を保存"}
                  </ActionButton>
                ) : (
                  <ActionButton
                    onClick={() => signInWithGoogle().catch(() => {})}
                    icon={<Bookmark size={18} />}
                    className="order-7 w-full lg:order-none"
                  >
                    ログインして保存
                  </ActionButton>
                ))}

              <ActionButton
                variant="ghost"
                onClick={handleShare}
                icon={shareFeedback ? <Check size={18} /> : <Share2 size={18} />}
                className="order-8 w-full lg:order-none"
              >
                {shareFeedback ? "画像を保存＆コピーしました" : "この旅を共有"}
              </ActionButton>

              <ActionButton
                variant="ghost"
                onClick={handleCopyLink}
                icon={linkCopied ? <Check size={18} /> : <Link2 size={18} />}
                className="order-8 w-full lg:order-none"
              >
                {linkCopied ? "リンクをコピーしました" : "共有リンクをコピー"}
              </ActionButton>
            </div>
          </motion.div>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-[color:var(--line)] pt-8 sm:flex-row">
            <p className="text-sm font-medium text-[color:var(--muted)]">
              この行き先、どう？ 同じ{journey.prefecture.nameJa}で、別の場所も探せるよ。
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <ActionButton
                onClick={chooseDestination}
                icon={<RotateCcw size={17} />}
              >
                別の場所にする
              </ActionButton>
              <button
                type="button"
                onClick={returnToStart}
                className="inline-flex items-center justify-center gap-1.5 text-sm font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
              >
                <House size={15} />
                最初からやり直す
              </button>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
