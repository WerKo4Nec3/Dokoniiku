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
};

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
  isMock: boolean;
};
