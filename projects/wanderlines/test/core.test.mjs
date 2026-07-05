// Zero-dependency tests for the Wanderlines core — the SAME module the shipped app embeds
// (build.mjs injects src/core.mjs into prototype/index.html). Run: node test/core.test.mjs
import {
  LISTS, listById, visitsOf, listRank, primaryVisit, syncPrimary, isWish, colorFor, yearsTraveled,
  unionPairs, mergeRegion, reattachPhotos, mergeJourneys, mergeLocalInto,
} from "../src/core.mjs";

let passed = 0, failed = 0;
function ok(name, cond) {
  if (cond) { passed++; console.log("  \x1b[32m✓\x1b[0m " + name); }
  else { failed++; console.log("  \x1b[31m✗ " + name + "\x1b[0m"); }
}

console.log("\nWanderlines core\n");

// ---- lists + multi-visit model ----
ok("three default lists incl. one wish", LISTS.length === 3 && LISTS.filter((l) => l.wish).length === 1);
ok("listById finds by id", listById(LISTS, "lived").name === "Lived" && listById(LISTS, "nope") === undefined);

const legacy = { listId: "visited", year: 2018 };
ok("visitsOf falls back to a legacy single visit", visitsOf(legacy).length === 1 && visitsOf(legacy)[0].year === 2018);
ok("visitsOf returns the visits array when present",
  visitsOf({ visits: [{ listId: "visited", year: 2017 }, { listId: "lived", year: 2021 }] }).length === 2);
ok("visitsOf of null is empty", visitsOf(null).length === 0);

ok("listRank: lived 3 > visited 2 > unknown 1 > wish 0",
  listRank("lived") === 3 && listRank("visited") === 2 && listRank("???") === 1 && listRank("wishlist") === 0);

const multi = { visits: [{ listId: "visited", year: 2017 }, { listId: "lived", year: 2021 }] };
ok("primary visit prefers higher-priority list (lived > visited)", primaryVisit(multi).listId === "lived");
ok("primary visit breaks list ties by latest year",
  primaryVisit({ visits: [{ listId: "visited", year: 2012 }, { listId: "visited", year: 2020 }] }).year === 2020);
ok("syncPrimary mirrors listId/year onto the mark",
  (() => { const m = { visits: multi.visits.slice() }; syncPrimary(m); return m.listId === "lived" && m.year === 2021; })());

ok("a mark with any non-wish visit is not wish", isWish(multi) === false);
ok("a wish-only mark is wish", isWish({ visits: [{ listId: "wishlist", year: 0 }] }) === true);
ok("isWish routes through the primary even if listId lags",
  isWish({ listId: "lived", visits: [{ listId: "wishlist", year: 0 }] }) === true);   // primary(wish) wins over a stale mirror
ok("colorFor uses the primary list color", colorFor(multi) === LISTS.find((l) => l.id === "lived").color);
ok("colorFor is null for wish-only", colorFor({ visits: [{ listId: "wishlist" }] }) === null);

ok("yearsTraveled counts distinct non-wish years across marks",
  yearsTraveled({ a: multi, b: { listId: "visited", year: 2021 }, c: { listId: "wishlist", year: 2099 } }) === 2); // 2017, 2021; wish + dup excluded

// ---- sync merge: union helpers ----
ok("unionPairs keeps first-seen key", (() => {
  const out = unionPairs([["a", 1], ["b", 2]], [["b", 9], ["c", 3]]);
  return out.length === 3 && out.find((e) => e[0] === "b")[1] === 2;   // local 'b' kept, not cloud's 9
})());
ok("mergeRegion deep-merges per key", (() => {
  const out = mergeRegion({ x: { a: 1 } }, { x: { b: 2 }, y: { c: 3 } });
  return out.x.a === 1 && out.x.b === 2 && out.y.c === 3;
})());

// ---- sync merge: photo re-attach (data-loss fix) ----
ok("reattachPhotos restores a stripped photo by id + entry", (() => {
  const oldJ = [{ id: "j1", journal: [{ date: "2024-01-01", text: "beach", photo: "PHOTO_A" }] }];
  const newJ = [{ id: "j1", journal: [{ date: "2024-01-01", text: "beach", photo: null }] }];
  reattachPhotos(newJ, oldJ);
  return newJ[0].journal[0].photo === "PHOTO_A";
})());
ok("reattachPhotos survives a CHANGED journey id via global content key", (() => {
  // the regression that lost photos: incoming journey has a different id, so id-match misses
  const oldJ = [{ id: "old-id", journal: [{ date: "2024-05-02", text: "market", photo: "PHOTO_B" }] }];
  const newJ = [{ id: "nm:Trip|2024", journal: [{ date: "2024-05-02", text: "market", photo: null }] }];
  reattachPhotos(newJ, oldJ);
  return newJ[0].journal[0].photo === "PHOTO_B";
})());
ok("reattachPhotos never clobbers a photo the new copy already has", (() => {
  const oldJ = [{ id: "j1", journal: [{ date: "d", text: "t", photo: "OLD" }] }];
  const newJ = [{ id: "j1", journal: [{ date: "d", text: "t", photo: "NEW" }] }];
  reattachPhotos(newJ, oldJ);
  return newJ[0].journal[0].photo === "NEW";
})());

// ---- sync merge: journeys ----
ok("mergeJourneys unions by id, never dropping one", (() => {
  const out = mergeJourneys([{ id: "a", journal: [] }], [{ id: "b", journal: [] }]);
  return out.length === 2 && out.some((j) => j.id === "a") && out.some((j) => j.id === "b");
})());
ok("mergeJourneys keeps the richer copy on an id clash", (() => {
  const lean = { id: "a", journal: [] };
  const rich = { id: "a", journal: [{ text: "one", photo: "P" }, { text: "two" }] };
  const out = mergeJourneys([lean], [rich]);
  return out.length === 1 && out[0].journal.length === 2;
})());
ok("mergeJourneys drops the seed Example once a real journey exists", (() => {
  const seed = new Set(["seed1"]);
  const out = mergeJourneys([{ id: "seed1", journal: [] }], [{ id: "real", journal: [] }], seed);
  return out.length === 1 && out[0].id === "real";
})());

// ---- sync merge: conflict union (clock-skew data-loss fix) ----
ok("mergeLocalInto unions both sides so a two-sided conflict loses nothing", (() => {
  const local = {
    marks: { FR: { listId: "lived", year: 2020 }, JP: { listId: "visited", year: 2019 } },
    regionMarks: {}, places: {}, airports: { LHR: 1 },
    journeys: [{ id: "localTrip", journal: [{ text: "hi", photo: "P" }] }],
    extraUnesco: [["A"]], extraParks: [], lists: LISTS,
  };
  const cloudDoc = { rev: 42, data: {
    marks: { FR: { listId: "visited", year: 2021 }, US: { listId: "lived", year: 2022 } },  // FR clashes, US only-cloud
    regionMarks: {}, places: {}, airports: { JFK: 1 },
    journeys: [{ id: "cloudTrip", journal: [] }],
    extraUnesco: [["B"]], extraParks: [], lists: LISTS,
  } };
  const m = mergeLocalInto(local, cloudDoc).data;
  return m.marks.JP && m.marks.US                       // local-only AND cloud-only marks both survive
    && m.marks.FR.year === 2021                          // cloud wins the same-key clash (newer revision)
    && m.airports.LHR && m.airports.JFK                  // airports unioned
    && m.journeys.length === 2                           // both journeys kept
    && m.extraUnesco.length === 2;                       // landmark lists unioned
})());
ok("mergeLocalInto preserves the cloud doc's rev/envelope", (() => {
  const out = mergeLocalInto({ marks: {}, journeys: [] }, { rev: 7, data: { marks: {}, journeys: [] } });
  return out.rev === 7 && out.data && typeof out.data === "object";
})());

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
