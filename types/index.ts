export type Direction =
  | "北"
  | "南"
  | "東"
  | "西"
  | "北東"
  | "北西"
  | "南東"
  | "南西";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type StartPoint = Coordinates & {
  name: string;
};

export type Prefecture = Coordinates & {
  id: string;
  nameJa: string;
  nameEn: string;
  region: string;
  shortDescriptionJa: string;
  accent: string;
};

export type Difficulty = "easy" | "medium" | "hard" | "epic" | "legendary";

export type DestinationCategory =
  | "nature"
  | "history"
  | "shrine"
  | "museum"
  | "hot-spring"
  | "food"
  | "viewpoint";

export type Destination = Coordinates & {
  id: string;
  name: string;
  prefectureId: string;
  categories: DestinationCategory[];
  description: string;
  imageUrl?: string;
  // Extra photos pulled from Wikimedia Commons for the result gallery.
  images?: string[];
  // ja.wikipedia article when it differs from the display name (quest spots).
  wikiTitle?: string;
};

export type TransportMode =
  | "walk"
  | "bicycle"
  | "motorbike"
  | "car"
  | "train"
  | "shinkansen";

export type WeatherInfo = {
  temperature: number;
  description: string;
  icon: "sun" | "cloud" | "rain" | "snow";
  advice: string;
  isMock: boolean;
  // Forecast extras (present when we have a specific day's forecast).
  high?: number;
  low?: number;
  precipitation?: number; // max chance of precipitation, %
  forDate?: string; // "YYYY-MM-DD" the forecast is for
  sunrise?: string; // "5:58" local time
  sunset?: string; // "17:12" local time
};

export type EstimatedBudget = {
  transportCost: number;
  activityCost: number;
  foodCost: number;
  total: number;
};

export type SearchProviderResult<T> = {
  data: T;
  provider: "live" | "mock";
  notice?: string;
};

export type JourneyResult = {
  id: string;
  createdAt: string;
  direction: Direction;
  start: StartPoint;
  prefecture: Prefecture;
  destination: Destination;
  weather: WeatherInfo;
  estimatedBudget: EstimatedBudget;
  estimatedTravelTime: number;
  distanceKm: number;
  people: number;
  transport: TransportMode;
  transfer: boolean;
  isMock: boolean;
};

// Where a saved place is in the user's journey: from idea to completed.
export type PlaceStatus =
  | "planned"
  | "going"
  | "enroute"
  | "exploring"
  | "done";

// A journey stored in the user's cloud list. `visited` is kept in sync with
// status === "done" for backward compatibility (map, share card).
export type SavedJourney = JourneyResult & {
  visited?: boolean;
  status?: PlaceStatus;
  // A day the user plans to go, as "YYYY-MM-DD".
  plannedDate?: string;
  // The traveller's own record, written after arriving.
  review?: TripReview;
  // GPS-confirmed visits (ISO timestamps, oldest first).
  checkIns?: string[];
};

export type TripReview = {
  rating: number; // 1..5
  text: string;
  photoIds: string[];
  // Arrival confirmed by GPS near the place.
  verified: boolean;
  visitedAt: string; // ISO
  public: boolean;
};

// A trip the traveller said "let's go" to; it stays open until they arrive
// and write their record (or give up).
export type ActiveTrip = {
  journey: JourneyResult;
  startedAt: string; // ISO
  arrivedAt?: string;
  verified?: boolean;
  // Done exploring; the record/rating step is showing.
  finishedAt?: string;
};

// A public review shown on the place's result page.
export type PlaceReview = {
  uid: string;
  name: string;
  avatarEmoji?: string;
  avatarColor?: string;
  rating: number;
  text: string;
  photoIds: string[];
  placeName: string;
  prefecture: string;
  verified: boolean;
  visitedAt: string;
};

// A friend's live position (shared for a limited time).
export type LiveLocation = {
  uid: string;
  name: string;
  avatarEmoji?: string;
  avatarColor?: string;
  lat: number;
  lon: number;
  accuracy: number;
  viewers: string[];
  updatedAt: number; // ms
  expiresAt: number; // ms
  heading?: string; // active trip destination, if any
};

// The user's lightweight "tabibito" (traveller) profile.
export type TabibitoProfile = {
  displayName?: string;
  bio?: string;
  avatarEmoji?: string;
  avatarColor?: string;
  // Chosen きせかえ skin id (see lib/tabiSkin.ts).
  tabiSkin?: string;
};

// ---- Social ----

// The public face of a user: what friends (and would-be friends) can see.
export type PublicProfile = TabibitoProfile & {
  uid: string;
  // Short shareable code other travellers use to send a friend request.
  friendCode: string;
  visitedCount?: number;
};

export type FriendRequest = {
  id: string;
  fromUid: string;
  toUid: string;
  fromName?: string;
};

// A journey card one traveller sent to another.
export type SharedCard = {
  id: string;
  fromUid: string;
  toUid: string;
  fromName?: string;
  friendshipId: string;
  journey: JourneyResult;
};

export type GroupCover =
  | "sunset"
  | "forest"
  | "ocean"
  | "sakura"
  | "night"
  | "citrus";

export type GroupCategory =
  | "onsen"
  | "hiking"
  | "gourmet"
  | "scenery"
  | "culture"
  | "drive"
  | "photo"
  | "other";

// A circle of travellers with a shared chat and joint-trip events.
export type Group = {
  id: string;
  name: string;
  emoji?: string;
  ownerUid: string;
  members: string[];
  // Discovery/community fields (all optional so old docs keep working).
  visibility?: "public" | "private"; // absent === private (safe default)
  nameLower?: string; // name.trim().toLowerCase() for prefix search
  about?: string;
  cover?: GroupCover;
  category?: GroupCategory;
  keywords?: string[];
};

export type GroupMessage = {
  id: string;
  uid: string;
  name?: string;
  text: string;
  // Firestore Timestamp (null while the local write is pending).
  createdAt?: { toDate: () => Date } | null;
};

// A quick "where should we go?" poll inside a group.
export type GroupPollOption = { id: string; label: string };
export type GroupPoll = {
  id: string;
  question: string;
  createdBy: string;
  createdByName?: string;
  options: GroupPollOption[];
  // uid → chosen option id (one vote each, changeable).
  votes: Record<string, string>;
};

// A planned joint trip: one saved card, one date, whoever joins.
export type GroupEvent = {
  id: string;
  createdBy: string;
  createdByName?: string;
  date: string;
  journey: JourneyResult;
  participants: string[];
};
