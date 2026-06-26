# Wanderlines

A **travel log** (not a planner) for trips you've already taken — the ground you
covered, the routes you travelled, how it went, and cute, shareable maps. Built to
stay **100% free** for everyone: no paid APIs, no backend required for the slice.

This is the materialized real project. The full clickable design prototype lives at
[`/prototype/index.html`](../../prototype/index.html) and is the source of truth for
the whole experience; this project is the **clean, tested core** of that design.

## Run

```bash
node serve.mjs            # serves http://127.0.0.1:5173
```

No dependencies, no install step.

## Test

```bash
node test/core.test.mjs   # exits non-zero on failure (33 assertions)
```

## Layout

| Path | What |
| --- | --- |
| `src/core.mjs` | Dependency-free domain logic: distance, **miles/km**, journey stats, the six vibes (distinct display fonts), and the **multi-visit model** (a location can hold several `{listId, year}` visits; lived > visited > wish primary). Shared by UI **and** tests. |
| `src/icons.mjs` | Our own single-stroke line-icons (no emoji) — vehicles + stop kinds. |
| `src/data.mjs` | Seed journeys (mocked, no backend). |
| `src/app.mjs` | The Journeys-log web slice + vibe switcher + miles/km toggle. |
| `styles.css` | Fully token-driven — every colour/font is a CSS variable the app swaps per vibe. |
| `test/core.test.mjs` | Zero-dep assertions over the core, incl. the multi-visit rules. |
| `serve.mjs` | Tiny static server. |

## The full app (in the prototype)

The design preview is a single self-contained file and covers the whole product:

- **World map** — scratch-off countries (tap to cycle Visited → Lived → Wish → clear);
  long-hold opens a detail sheet supporting **multiple visits per place, each with its
  own list and year**.
- **Journeys** — trips replayed as routes, with stops, travellers, and a photo journal.
- **Regions** — scratch off states/provinces (incl. US territories + MY/AT/FR/CH/RU).
- **Timeline** — by year, pinch to add cities & landmarks; one row per visit-year.
- **Lists / Explore** — by-year + visited/wishlist, National Parks & UNESCO, plus a
  searchable **Explore** page with rich per-country detail (open-data sourced & credited).
- **Account / Passport** — six vibes, miles/km, native names, collectible **stamps,
  flags & badges**, and three share faces: a generated **passport card** (PNG), a
  **live Leaflet map** with swappable free base-map styles, and a **QR share link** —
  plus **JSON backup / export & import**.

The `core.mjs` here is the tested heart of that design: the same numbers and the same
multi-visit rules the app shows, verified by the suite.

## Scope of this slice

The Journeys log: real journey cards whose **ground-covered (miles by default), day
count, stops, rating, vehicles, and kind-tagged stops** are rendered with our own
line-icons and computed by the same `core.mjs` the tests verify — plus the six
token-driven vibes (retro / sleek / disco / earthy / cute / classic), each with a
distinct title font, switchable live, and a **Miles ⇄ Kilometres** toggle.
