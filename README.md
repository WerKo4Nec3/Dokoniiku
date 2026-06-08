# Tabi Compass / 旅コンパス

Tabi Compass is a mobile-first Japanese travel discovery PWA for spontaneous weekend trips. Instead of filling out a search form, the user asks an original travel spirit named **Tabi** to choose a direction, a prefecture, and a destination.

> 「旅コンパス」は、旅の精タビが方角・都道府県・目的地をランダムに選び、週末の小さな旅を提案するモバイル向けPWAです。

## Concept

The core interaction feels like a compact travel game. Each reveal builds anticipation while the final result remains practical: weather, approximate travel time, budget breakdown, and a direct link to open the destination in Google Maps.

No copyrighted characters, logos, or anime assets are used. Tabi and the visual identity are original.

## Features

- Animated three-step journey selection
- Original SVG mascot with mood-based Framer Motion animation
- Internal prefecture metadata with direction-based selection from a user-selectable starting point (current location or a preset list of major cities)
- Wikipedia-powered attraction search (geosearch) with automatic mock fallback
- Wikipedia article summaries and photos enrich each destination's description, with a templated fallback when no article is found
- Optional category filter applied at the prefecture step
- Re-roll the destination within the same direction and prefecture (without repeating the current place), or return to the main menu to start over
- OpenWeather current conditions with automatic mock fallback
- One-tap link to open the destination directly in Google Maps
- Distance-based travel time estimate
- Category-based day-trip budget estimate
- Light and dark themes persisted in `localStorage`
- Loading, empty, error-fallback, and mock-mode states
- Responsive mobile-first interface
- Web app manifest, service worker, and offline fallback

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Framer Motion
- Wikipedia (geosearch and page-summary REST APIs, keyless) and OpenWeather APIs
- Lucide icons

## Architecture

```text
app/                  Routes, metadata, manifest, and global styles
components/           Shared layout and UI primitives
features/journey/     Journey state machine and staged UI
features/mascot/      Original mascot component
lib/api/              Attraction and weather provider functions
lib/storage/          localStorage repository
lib/utils/            Selection, distance, time, and budget logic
data/                 Small prefecture and fallback destination datasets
types/                Domain types independent of UI and map providers
```

The journey result links out to Google Maps with the destination's coordinates rather than embedding a map, keeping the MVP free of map provider keys and SDK weight.

## API Strategy

`getAttractionsByPrefecture()` queries Wikipedia's geosearch API (`ja.wikipedia.org/w/api.php?list=geosearch`) around the selected prefecture's coordinates, then filters the results with title-based heuristics to keep likely sightseeing spots (castles, shrines, temples, gardens, museums, viewpoints...) and drop generic entries (offices, hospitals, stations...). `getDestinationSummary()` then fetches a real Japanese-language description and photo for the chosen destination from Wikipedia's page-summary REST API (`ja.wikipedia.org/api/rest_v1/page/summary`), replacing the templated description when an article is found. `getWeatherByCoordinates()` loads current weather for the chosen destination from OpenWeather.

Wikipedia's APIs are free, keyless, and CORS-enabled, so attraction search and description enrichment work entirely client-side without any configuration. All providers return a common `SearchProviderResult<T>` with `live` or `mock` status — network failures, empty results, and API errors automatically fall back to local demo data instead of breaking the journey.

## Estimation Logic

Travel distance uses the Haversine formula from Kobe-Sannomiya. The MVP time estimate is:

```text
minutes = round(distanceKm / 45 * 60 + 20)
```

Budget is the sum of:

- Round-trip transport: distance-based and rounded to the nearest ¥100
- Activity: category-based midpoint
- Food: fixed ¥1,200

All values are explicitly presented as estimates, not real fare claims.

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app works without environment variables in mock mode.

## Environment Variables

Copy `.env.example` to `.env.local` and set the available key:

```bash
NEXT_PUBLIC_OPENWEATHER_API_KEY=
```

Attraction search and destination descriptions use Wikipedia's free, keyless APIs and need no configuration. Without an OpenWeather key the app shows demo weather instead of live conditions.

## Future Improvements

- Route provider for real transit duration and fares
- Embedded map view (Leaflet/OpenStreetMap or Google Maps) alongside the existing external link
- Reverse geocoding for a friendly label when using "current location" as the starting point
- Forecast selection by intended travel date
- Smarter attraction filtering (e.g. Wikidata categories instead of title heuristics)
- Shareable journey URLs
- IndexedDB caching for richer offline use

## Screenshots

Add final desktop and mobile screenshots here after deployment.

## Generated Asset

The travel backdrop was created as an original, project-specific bitmap illustration using OpenAI's built-in image generation tool. It contains no text, logos, people, or copyrighted characters. The original mascot is implemented as editable SVG code.
