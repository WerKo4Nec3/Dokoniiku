import type { SavedJourney } from "@/types";
import { formatYen } from "@/lib/utils/travel";

// Turn a scheduled trip into a calendar event (all-day, on plannedDate).
// Keyless: a Google Calendar template URL, or a downloadable .ics data URL.

function compact(dateIso: string): string {
  return dateIso.replace(/-/g, "");
}
function nextDay(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const next = new Date(y, m - 1, d + 1);
  const yy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, "0");
  const dd = String(next.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

function title(journey: SavedJourney): string {
  return `${journey.destination.name}（${journey.prefecture.nameJa}）`;
}
function details(journey: SavedJourney): string {
  const budget = formatYen(journey.estimatedBudget.total);
  return `旅コンパスの旅プラン\n目的地: ${journey.destination.name}\n${journey.prefecture.nameJa} ・ 約${journey.distanceKm}km\n予算の目安: ${budget}`;
}

export function googleCalendarUrl(journey: SavedJourney): string | null {
  if (!journey.plannedDate) return null;
  const start = compact(journey.plannedDate);
  const end = nextDay(journey.plannedDate);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title(journey),
    dates: `${start}/${end}`,
    details: details(journey),
    location: `${journey.prefecture.nameJa} ${journey.destination.name}`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function icsDataUrl(journey: SavedJourney): string | null {
  if (!journey.plannedDate) return null;
  const start = compact(journey.plannedDate);
  const end = nextDay(journey.plannedDate);
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dokoniiku//Tabi Compass//JA",
    "BEGIN:VEVENT",
    `UID:${journey.id}@dokoniiku`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${esc(title(journey))}`,
    `DESCRIPTION:${esc(details(journey))}`,
    `LOCATION:${esc(`${journey.prefecture.nameJa} ${journey.destination.name}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

export function icsFileName(journey: SavedJourney): string {
  return `dokoniiku-${journey.destination.name}.ics`;
}
