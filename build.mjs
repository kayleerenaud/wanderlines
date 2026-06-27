#!/usr/bin/env node
// Build the deployable PWA (docs/) from the single source file (prototype/index.html).
// Injects the PWA head tags + service-worker registration, and bumps the SW cache version
// so installed clients always pull the fresh build. Run: node build.mjs
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "prototype/index.html";
const OUT = "docs/index.html";
const SW = "docs/sw.js";

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
if('serviceWorker' in navigator){ window.addEventListener('load',function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); }); }
</script>
</body>`;

let html = readFileSync(SRC, "utf8");
if ((html.match(/<title>Wanderlines<\/title>/g) || []).length !== 1) throw new Error("expected exactly one <title>Wanderlines</title> in source");
if ((html.match(/<\/body>/g) || []).length !== 1) throw new Error("expected exactly one </body> in source");
html = html.replace("<title>Wanderlines</title>", HEAD).replace("</body>", SW_REG);
writeFileSync(OUT, html);

// bump wanderlines-vN -> wanderlines-v(N+1) so installed PWAs refresh
let sw = readFileSync(SW, "utf8");
const m = sw.match(/wanderlines-v(\d+)/);
if (!m) throw new Error("could not find cache version in " + SW);
const next = Number(m[1]) + 1;
sw = sw.replace(/wanderlines-v\d+/, "wanderlines-v" + next);
writeFileSync(SW, sw);

console.log(`built ${OUT} (${(html.length / 1024).toFixed(0)} KB) · service-worker cache -> wanderlines-v${next}`);
