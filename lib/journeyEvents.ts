// Fired after anything that changes the traveller's saved journeys (save,
// status, check-in, record), so listeners such as the achievement toaster
// can re-evaluate.
export const JOURNEYS_CHANGED = "dokoniiku:journeys-changed";

export function notifyJourneysChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(JOURNEYS_CHANGED));
}
