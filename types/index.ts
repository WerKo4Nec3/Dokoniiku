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

// A journey stored in the user's cloud list; `visited` marks places the
// user has actually been to.
export type SavedJourney = JourneyResult & {
  visited?: boolean;
};
