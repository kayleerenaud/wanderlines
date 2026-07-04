# Wanderlines

A **travel log** (not a planner) for trips you've already taken: the ground you
covered, the routes you traveled, how it went, and cute, shareable maps. Built to
stay **100% free** for everyone: no paid APIs.

The app itself is a single self-contained PWA at
[`/prototype/index.html`](../../prototype/index.html) (the source of truth for the
whole experience). This folder is its **tested core**: the pure domain + cloud-sync
logic in `src/core.mjs`, which is embedded verbatim into the app at build time — so
the rules the tests verify are the exact rules that ship.

## Build & run

```bash
node ../../build.mjs      # embed src/core.mjs into the prototype + write the deployable /docs build
node serve.mjs            # serve that build at http://127.0.0.1:5173
```

No dependencies, no install step.

## Test

```bash
node test/core.test.mjs   # zero-dep assertions over the shared core (exits non-zero on failure)
```

## How the core is shared (no parallel copy)

`src/core.mjs` is a dependency-free ES module. It is imported directly by the Node test
suite, **and** `build.mjs` strips its `export`s, wraps it in an IIFE, and injects it into
a generated region in `prototype/index.html` (bound to the app's live `state.lists` by a
thin adapter). There is exactly one copy of this logic; the app can't drift from its tests.

| Path | What |
| --- | --- |
| `src/core.mjs` | The **only** home of the pure logic: the **multi-visit model** (a place can hold several `{listId, year}` visits; lived > visited > wish primary; `isWish`/`colorFor`/`yearsTraveled`), and the **cloud-sync merge rules** (`reattachPhotos`, `mergeJourneys`, `mergeLocalInto`, `unionPairs`) that keep data safe across devices. |
| `test/core.test.mjs` | Zero-dep assertions over that core — the multi-visit rules and the sync/merge data-safety guarantees (photos survive a changed journey id; a two-sided conflict unions rather than dropping a side). |
| `serve.mjs` | Tiny static server for the built `/docs` PWA. |
| `../../build.mjs` | Embeds the core into the prototype and writes `/docs`. |

Rendering, the map projection (`d3.geoDistance`), theming (CSS custom properties), and DOM
wiring live in the app where they belong — only genuinely pure, testable logic is in the core.

## The app (in the prototype)

A single self-contained file covering the whole product:

- **World map**: scratch-off countries (tap to cycle Visited → Lived → Wish → clear);
  long-hold opens a detail sheet supporting **multiple visits per place, each with its
  own list and year**.
- **Journeys**: trips replayed as routes, with stops, travelers, and a photo journal.
- **Regions**: scratch off states/provinces (incl. US territories + MY/AT/FR/CH/RU).
- **Timeline**: by year, pinch to add cities & landmarks; one row per visit-year.
- **Lists / Explore**: by-year + visited/wishlist, National Parks & UNESCO, plus a
  searchable **Explore** page with rich per-country detail (open-data sourced & credited).
- **Account / Passport**: six vibes, miles/km, native names, collectible **stamps,
  flags & badges**, and three share faces: a generated **passport card** (PNG), a
  **live Leaflet map** with swappable free base-map styles, and a **QR share link**,
  plus **JSON backup / export & import**, and optional cloud sync across devices.
