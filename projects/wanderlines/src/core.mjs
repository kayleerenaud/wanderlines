// Wanderlines — pure, dependency-free domain logic.
// Shared by the web UI (src/app.mjs) and the Node test suite (test/core.test.mjs),
// so the numbers the app shows are the same ones the tests verify.

const R_KM = 6371; // mean Earth radius
const rad = (d) => (d * Math.PI) / 180;

/** Great-circle distance (km) between two [lon, lat] points. */
export function haversineKm(a, b) {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Total ground covered (km, rounded) along a journey's ordered stops. */
export function groundCoveredKm(stops = []) {
  let km = 0;
  for (let i = 1; i < stops.length; i++) {
    km += haversineKm([stops[i - 1].lon, stops[i - 1].lat], [stops[i].lon, stops[i].lat]);
  }
  return Math.round(km);
}

/** Inclusive day count between two YYYY-MM-DD strings (0 if either missing). */
export function daysBetween(start, end) {
  if (!start || !end) return 0;
  const a = new Date(start + "T00:00:00");
  const b = new Date(end + "T00:00:00");
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

export const kmToMi = (km) => Math.round(km * 0.621371);

/** Format a km distance in the user's units (miles is the default). */
export function formatDistance(km, units = "mi") {
  const v = units === "km" ? km : kmToMi(km);
  return { value: v.toLocaleString(), unit: units === "km" ? "km" : "mi" };
}

/** The headline stats for a journey card / detail page. */
export function journeyStats(j, units = "mi") {
  const km = groundCoveredKm(j.stops || []);
  return {
    km,
    distance: formatDistance(km, units),
    stops: (j.stops || []).length,
    days: daysBetween(j.start, j.end),
    travellers: (j.travelers || []).length,
  };
}

export const STOP_KINDS = ["country", "region", "unesco", "park", "city", "water"];

export const REQUIRED_TOKENS = [
  "--ocean", "--paper", "--ink", "--accent", "--accent2",
  "--c-lived", "--c-visited", "--font", "--font-display",
];

/** Six token-driven vibes. Each carries its own palette, body font, and a
 *  distinct display font for titles (the bug-fixed, vibe-specific set). */
export const THEMES = {
  retro: {
    "--ocean": "#edd2a0", "--ocean-hi": "#f7ebcb", "--land": "#39281f",
    "--paper": "#f8eccf", "--ink": "#2a1d14", "--muted": "#9a7e57", "--rule": "#d6a347",
    "--field": "#fff7e6", "--accent": "#df4d12", "--accent2": "#0c8a6f", "--gold": "#eaa314",
    "--c-lived": "#df4d12", "--c-visited": "#0c8a6f", "--on-accent": "#fff",
    "--font": '"Jost",system-ui,sans-serif', "--font-display": '"Bungee","Jost",sans-serif',
  },
  sleek: {
    "--ocean": "#0e0f12", "--ocean-hi": "#191b1f", "--land": "#2c2f36",
    "--paper": "#16181c", "--ink": "#eef1f5", "--muted": "#99a0ac", "--rule": "#33373f",
    "--field": "#1f2228", "--accent": "#c4ccd6", "--accent2": "#878f9b", "--gold": "#d6dce4",
    "--c-lived": "#d2d8e0", "--c-visited": "#7f8893", "--on-accent": "#15171b",
    "--font": '"Inter",system-ui,sans-serif', "--font-display": '"Space Grotesk","Inter",sans-serif',
  },
  disco: {
    "--ocean": "#16022c", "--ocean-hi": "#2a0750", "--land": "#2b0a47",
    "--paper": "#1d0636", "--ink": "#fdeeff", "--muted": "#c79be0", "--rule": "#7a2bd0",
    "--field": "#270a40", "--accent": "#ff2bd6", "--accent2": "#1fe3cb", "--gold": "#f5e63d",
    "--c-lived": "#ff2bd6", "--c-visited": "#1fe3cb", "--on-accent": "#fff",
    "--font": '"Righteous",system-ui,sans-serif', "--font-display": '"Monoton","Righteous",sans-serif',
  },
  earthy: {
    "--ocean": "#dce4d1", "--ocean-hi": "#eef1e4", "--land": "#3a4a32",
    "--paper": "#eef0e3", "--ink": "#26301f", "--muted": "#7c8a6c", "--rule": "#a8b58f",
    "--field": "#f7f9ef", "--accent": "#5b7a3a", "--accent2": "#a3672f", "--gold": "#bf8f33",
    "--c-lived": "#a3672f", "--c-visited": "#5b7a3a", "--on-accent": "#fff",
    "--font": "Georgia,serif", "--font-display": '"Fraunces","Georgia",serif',
  },
  cute: {
    "--ocean": "#fdf4f9", "--ocean-hi": "#fffafd", "--land": "#ecd9e6",
    "--paper": "#fdf5fa", "--ink": "#6f5a64", "--muted": "#bda4b4", "--rule": "#f0d3e0",
    "--field": "#fffbfe", "--accent": "#f3a6c6", "--accent2": "#f3d089", "--gold": "#f1cd7c",
    "--c-lived": "#f1a3c4", "--c-visited": "#eccb84", "--on-accent": "#fff",
    "--font": '"Quicksand",system-ui,sans-serif', "--font-display": '"Baloo 2","Quicksand",sans-serif',
  },
  classic: {
    "--ocean": "#ece2cd", "--ocean-hi": "#f5eedd", "--land": "#dccdab",
    "--paper": "#f1e8d3", "--ink": "#3a2f25", "--muted": "#9a8467", "--rule": "#c3ad84",
    "--field": "#f6efdd", "--accent": "#a6442e", "--accent2": "#4a5a6a", "--gold": "#9a6b34",
    "--c-lived": "#a6442e", "--c-visited": "#4a5a6a", "--on-accent": "#fff",
    "--font": '"EB Garamond",Georgia,serif', "--font-display": '"Caveat",cursive',
  },
};

export const THEME_ORDER = ["retro", "sleek", "disco", "earthy", "cute", "classic"];

// ---------------------------------------------------------------------------
// Multi-visit model
//
// A logged location can hold SEVERAL visits, each its own {listId, year}.
// The map paints by the "primary" visit: the highest-priority list
// (lived > visited > other > wish), breaking ties by the most recent year.
// `listId`/`year` on a mark mirror that primary so single-value consumers keep
// working. These are the same rules the prototype uses, verified here.
// ---------------------------------------------------------------------------

export const LISTS = [
  { id: "lived", name: "Lived", color: "#b5532a" },
  { id: "visited", name: "Visited", color: "#1f6f6b" },
  { id: "wishlist", name: "Wish List", color: null, wish: true },
];

const listById = (lists, id) => lists.find((l) => l.id === id);

/** Every visit on a mark; falls back to a single {listId, year} for legacy marks. */
export function visitsOf(mark) {
  if (!mark) return [];
  if (Array.isArray(mark.visits) && mark.visits.length) return mark.visits;
  return [{ listId: mark.listId, year: mark.year }];
}

/** Priority of a list: lived (3) > visited/other (2) > unknown (1) > wish (0). */
export function listRank(id, lists = LISTS) {
  const l = listById(lists, id);
  if (!l) return 1;
  if (l.wish) return 0;
  if (l.id === "lived") return 3;
  return 2;
}

/** The representative visit a mark is painted/sorted by. */
export function primaryVisit(mark, lists = LISTS) {
  const vs = visitsOf(mark);
  if (!vs.length) return null;
  return vs.slice().sort((a, b) => {
    const r = listRank(b.listId, lists) - listRank(a.listId, lists);
    return r || (+b.year || 0) - (+a.year || 0);
  })[0];
}

/** Mirror listId/year onto the mark's primary visit (returns the mark). */
export function syncPrimary(mark, lists = LISTS) {
  if (!mark) return mark;
  const p = primaryVisit(mark, lists);
  if (p) { mark.listId = p.listId; mark.year = p.year; }
  return mark;
}

/** A mark is "wish" only when its primary visit is a wish-list visit. */
export function isWish(mark, lists = LISTS) {
  const p = primaryVisit(mark, lists);
  const l = p && listById(lists, p.listId);
  return !!(l && l.wish);
}

/** The scratch-off colour for a mark (null for wish / unknown). */
export function markColor(mark, lists = LISTS) {
  const p = primaryVisit(mark, lists);
  const l = p && listById(lists, p.listId);
  return l && !l.wish ? l.color : null;
}

/** Distinct non-wish years across all marks — the "years travelled" stat. */
export function yearsTravelled(marks, lists = LISTS) {
  const ys = new Set();
  Object.values(marks || {}).forEach((m) =>
    visitsOf(m).forEach((v) => {
      const l = listById(lists, v.listId);
      if (v.year && !(l && l.wish)) ys.add(v.year);
    })
  );
  return ys.size;
}
