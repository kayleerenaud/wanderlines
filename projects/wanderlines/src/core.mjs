// Wanderlines: pure, dependency-free domain + sync logic.
//
// This is the SINGLE SOURCE OF TRUTH for the app's non-DOM logic. The Node test suite
// (test/core.test.mjs) imports it directly, and the web app (prototype/index.html) embeds
// it verbatim at build time (build.mjs injects this file into a generated <core> region and
// wraps it with a thin adapter that binds `state.lists`). So the numbers and merge rules the
// tests verify are the exact ones the shipped app runs — no parallel copy to drift.
//
// Only genuinely pure, testable logic lives here. Rendering, the map projection (d3.geoDistance),
// theming (CSS custom properties), and DOM wiring stay in the app where they belong.

// ---------------------------------------------------------------------------
// Multi-visit model
//
// A logged location can hold SEVERAL visits, each its own {listId, year}. The map paints by the
// "primary" visit: the highest-priority list (lived > visited/other > unknown > wish), breaking
// ties by the most recent year. `listId`/`year` on a mark mirror that primary (via syncPrimary)
// so single-value consumers keep working. isWish/colorFor route through the primary so they stay
// correct even if a mark's mirrored listId ever lags its visits.
// ---------------------------------------------------------------------------

export const LISTS = [
  { id: "lived", name: "Lived", color: "#b5532a" },
  { id: "visited", name: "Visited", color: "#1f6f6b" },
  { id: "wishlist", name: "Wish List", color: null, wish: true },
];

/** Look up a list by id within a lists array. */
export function listById(lists, id) { return (lists || []).find((l) => l.id === id); }

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

/** Mirror listId/year onto the mark from its primary visit (returns the mark). */
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

/** The scratch-off color for a mark (null for wish / unknown). */
export function colorFor(mark, lists = LISTS) {
  const p = primaryVisit(mark, lists);
  const l = p && listById(lists, p.listId);
  return l && !l.wish ? l.color : null;
}

/** Distinct non-wish years across all marks — the "years traveled" stat. */
export function yearsTraveled(marks, lists = LISTS) {
  const ys = new Set();
  Object.values(marks || {}).forEach((m) =>
    visitsOf(m).forEach((v) => {
      const l = listById(lists, v.listId);
      if (v.year && !(l && l.wish)) ys.add(v.year);
    })
  );
  return ys.size;
}

// ---------------------------------------------------------------------------
// Cloud-sync merge logic
//
// Sync is whole-document, revision-based. These pure helpers decide how a cloud document and the
// local document combine WITHOUT losing data. The rules that matter for data safety:
//  - reattachPhotos: a cloud/backup copy may have had photos stripped to fit. Never drop a photo we
//    still hold locally — re-attach by journey id + entry, and by GLOBAL content key so a photo
//    survives even when a journey's id changed (e.g. a synthetic merge id).
//  - mergeJourneys: union by id, keeping the richer copy on a clash; never drop a journey.
//  - mergeLocalInto: when BOTH sides advanced since the last sync (a genuine conflict), union them
//    rather than picking a winner by wall-clock (a skewed clock silently drops one side).
// ---------------------------------------------------------------------------

/** Union two [key, ...] pair-lists, keeping the first occurrence of each key. */
export function unionPairs(a, b) {
  a = Array.isArray(a) ? a : [];
  b = Array.isArray(b) ? b : [];
  const seen = new Set(a.map((e) => e[0]));
  const out = a.slice();
  b.forEach((e) => { if (!seen.has(e[0])) { seen.add(e[0]); out.push(e); } });
  return out;
}

/** Shallow-merge two region maps (per-key object spread; b wins a same-key clash). */
export function mergeRegion(a, b) {
  const out = { ...(a || {}) };
  for (const k in (b || {})) out[k] = { ...((a && a[k]) || {}), ...b[k] };
  return out;
}

/** Re-attach photos from `oldJ` onto `newJ` (matched by id + entry, then global content key). */
export function reattachPhotos(newJ, oldJ) {
  if (!Array.isArray(newJ) || !Array.isArray(oldJ)) return newJ;
  const oldById = new Map();
  oldJ.forEach((j) => { if (j && j.id) oldById.set(j.id, j); });
  const ek = (e) => ((e && e.date) || "") + "|" + (((e && e.text) || "").slice(0, 60));
  // Global content-keyed photo map across ALL old journeys, so a photo survives even when a journey's
  // id changed and the per-journey id match below misses. Content (date+text) only — never a
  // cross-journey index, which would mis-assign.
  const global = new Map();
  oldJ.forEach((j) => { if (j && Array.isArray(j.journal)) j.journal.forEach((e) => { if (e && e.photo && !global.has(ek(e))) global.set(ek(e), e.photo); }); });
  newJ.forEach((j) => {
    if (!j || !Array.isArray(j.journal)) return;
    const oj = oldById.get(j.id);
    const byKey = new Map();
    if (oj && Array.isArray(oj.journal)) oj.journal.forEach((e, i) => { if (e && e.photo) { byKey.set(ek(e), e.photo); byKey.set("#" + i, e.photo); } });
    j.journal.forEach((e, i) => { if (e && !e.photo) { const p = byKey.get(ek(e)) || byKey.get("#" + i) || global.get(ek(e)); if (p) e.photo = p; } });
  });
  return newJ;
}

/** "Richness" of a journey — more real entries/photos/stops/people ranks higher on an id clash. */
function journeyScore(j) {
  if (!j) return -1;
  const jn = j.journal || [];
  return jn.filter((e) => e && (e.text || e.photo)).length * 10
    + jn.filter((e) => e && e.photo).length * 8
    + (j.stops || []).length + (j.travelers || []).length + (j.remember || []).length;
}

/** Merge journey arrays by id, never dropping one: union all, keep the richer copy on a clash, and
 *  drop the seeded Example once any real journey exists. */
export function mergeJourneys(local, cloud, seedIds = new Set()) {
  local = Array.isArray(local) ? local : [];
  cloud = Array.isArray(cloud) ? cloud : [];
  const byId = new Map();
  const add = (j) => {
    if (!j) return;
    const id = j.id || ("nm:" + (j.name || "") + "|" + (j.start || ""));
    const ex = byId.get(id);
    if (!ex || journeyScore(j) >= journeyScore(ex)) byId.set(id, j);
  };
  local.forEach(add); cloud.forEach(add);
  let out = [...byId.values()];
  if (out.some((j) => j && !seedIds.has(j.id))) out = out.filter((j) => j && !seedIds.has(j.id));
  return out;
}

/** Conflict resolution: union a local state into a cloud document so nothing is lost. Keyed maps keep
 *  every key from both (cloud wins a same-key clash, being the newer revision); journeys merge by id
 *  keeping the richer copy; landmark lists union. Returns a new cloud-shaped document. */
export function mergeLocalInto(local, cloudDoc, seedIds = new Set()) {
  const c = (cloudDoc && cloudDoc.data && typeof cloudDoc.data === "object") ? cloudDoc.data : (cloudDoc || {});
  const uni = (loc, cld) => ({ ...(loc && typeof loc === "object" ? loc : {}), ...(cld && typeof cld === "object" ? cld : {}) });
  const merged = {
    ...c,
    marks: uni(local.marks, c.marks),
    regionMarks: uni(local.regionMarks, c.regionMarks),
    places: uni(local.places, c.places),
    airports: uni(local.airports, c.airports),
    journeys: mergeJourneys(local.journeys, Array.isArray(c.journeys) ? c.journeys : [], seedIds),
    extraUnesco: unionPairs(local.extraUnesco, c.extraUnesco),
    extraParks: unionPairs(local.extraParks, c.extraParks),
    lists: (Array.isArray(c.lists) && c.lists.length) ? c.lists : local.lists,
  };
  return { ...(cloudDoc || {}), data: merged };
}
