#!/usr/bin/env node
// Build the deployable PWA (docs/) from the single source file (prototype/index.html).
// Steps: (1) inject the shared domain+sync core (projects/wanderlines/src/core.mjs) into the prototype's
// generated core region — the SAME module the Node test suite imports, so tested logic == shipped logic;
// (2) inject the PWA head tags + service-worker registration; (3) bump the SW cache version so installed
// clients pull the fresh build. Run: node build.mjs
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "prototype/index.html";
const OUT = "docs/index.html";
const SW = "docs/sw.js";
const CORE = "projects/wanderlines/src/core.mjs";

// ---- Step 1: embed the shared core into the prototype's generated region (idempotent, in place) ----
// core.mjs is dependency-free ESM; strip its `export`s, wrap it in an IIFE exposing the public names, and
// bind them to the app's live `state.lists`/seed ids with a thin adapter so existing call sites are unchanged.
function buildCoreRegion() {
  const src = readFileSync(CORE, "utf8");
  const names = [...src.matchAll(/export\s+(?:function|const)\s+(\w+)/g)].map((m) => m[1]);
  if (!names.length) throw new Error("no exports found in " + CORE);
  const body = src.replace(/^export\s+/gm, "");
  return [
    "// ==== core:begin ==== GENERATED from projects/wanderlines/src/core.mjs by build.mjs — DO NOT EDIT HERE.",
    "// One source of truth: core.mjs (imported by the Node tests) embedded here + bound to state.lists below.",
    "// The rules the tests verify are the exact rules the app runs. Run `node build.mjs` to refresh this block.",
    "const __wlcore = (() => {",
    body.trimEnd(),
    "return { " + names.join(", ") + " };",
    "})();",
    "// adapter — bind the app's live state.lists + seed ids to the pure core (call sites stay unchanged)",
    "const listById = (id) => __wlcore.listById(state.lists, id);",
    "const visitsOf = __wlcore.visitsOf;",
    "const listRank = (id) => __wlcore.listRank(id, state.lists);",
    "const primaryVisit = (m) => __wlcore.primaryVisit(m, state.lists);",
    "const syncPrimary = (m) => __wlcore.syncPrimary(m, state.lists);",
    "const isWish = (m) => __wlcore.isWish(m, state.lists);",
    "const colorFor = (m) => __wlcore.colorFor(m, state.lists);",
    "const _unionPairs = __wlcore.unionPairs;",
    "const _mergeRegion = __wlcore.mergeRegion;",
    "const _reattachPhotos = __wlcore.reattachPhotos;",
    "const _seedJourneyIds = () => new Set((typeof SEED_JOURNEYS !== 'undefined' ? SEED_JOURNEYS : []).map((j) => j && j.id).filter(Boolean));",
    "const _mergeJourneys = (local, cloud) => __wlcore.mergeJourneys(local, cloud, _seedJourneyIds());",
    "const _mergeLocalInto = (cloudDoc) => __wlcore.mergeLocalInto(state, cloudDoc, _seedJourneyIds());",
    "// ==== core:end ====",
  ].join("\n");
}
{
  const proto = readFileSync(SRC, "utf8");
  const region = /\/\/ ==== core:begin ====[\s\S]*?\/\/ ==== core:end ====/;
  if (!region.test(proto)) throw new Error("could not find the core:begin/core:end region in " + SRC);
  const updated = proto.replace(region, () => buildCoreRegion());
  if (updated !== proto) { writeFileSync(SRC, updated); console.log("embedded core -> " + SRC); }
}

const HEAD = `<title>Wanderlines</title>
<meta name="description" content="A free travel log: scratch off the countries you've been to, log your journeys, and make share-worthy maps." />
<link rel="manifest" href="manifest.webmanifest" />
<meta name="theme-color" content="#df4d12" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="Wanderlines" />
<link rel="apple-touch-icon" href="apple-touch-icon.png" />
<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png" />`;

const SW_REG = `<script>
if('serviceWorker' in navigator){
  // auto-reload once when a new version takes control, so an installed PWA never gets stuck on stale code
  var __swReloaded=false;
  navigator.serviceWorker.addEventListener('controllerchange',function(){ if(!__swReloaded){ __swReloaded=true; location.reload(); } });
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('sw.js').then(function(reg){ try{ reg.update(); }catch(e){}
      setInterval(function(){ try{ reg.update(); }catch(e){} }, 60000); }).catch(function(){});
  });
}
</script>
</body>`;

// bump wanderlines-vN -> wanderlines-v(N+1) so installed PWAs refresh
let sw = readFileSync(SW, "utf8");
const m = sw.match(/wanderlines-v(\d+)/);
if (!m) throw new Error("could not find cache version in " + SW);
const next = Number(m[1]) + 1;
sw = sw.replace(/wanderlines-v\d+/, "wanderlines-v" + next);

let html = readFileSync(SRC, "utf8");
if ((html.match(/<title>Wanderlines<\/title>/g) || []).length !== 1) throw new Error("expected exactly one <title>Wanderlines</title> in source");
if ((html.match(/<\/body>/g) || []).length !== 1) throw new Error("expected exactly one </body> in source");
html = html.replace("<title>Wanderlines</title>", HEAD).replace("</body>", SW_REG).replaceAll("__APP_VER__", "v" + next);
writeFileSync(OUT, html);
writeFileSync(SW, sw);

console.log(`built ${OUT} (${(html.length / 1024).toFixed(0)} KB) · service-worker cache -> wanderlines-v${next}`);
