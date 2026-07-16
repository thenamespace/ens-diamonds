// Post-deploy smoke: node scripts/smoke.mjs https://<deployment>
const base = process.argv[2];
if (!base) { console.error("usage: node scripts/smoke.mjs <baseUrl>"); process.exit(1); }
const checks = [
  ["/", 200, "ens.diamonds"],
  ["/pools", 200, "Vaults"],
  ["/about", 200, "Namespace"],
  ["/api/discover?sort=ending&offset=0", 200, '"entries"'],
  ["/api/name-status?label=vitalik", 200, '"status"'],
  ["/api/resolve?q=vitalik.eth", 200, '"address"'],
];
let failed = 0;
for (const [path, code, needle] of checks) {
  const res = await fetch(base + path);
  const body = await res.text();
  const ok = res.status === code && body.includes(needle);
  console.log(ok ? "✓" : "✗", path, res.status);
  if (!ok) failed++;
}
process.exit(failed ? 1 : 0);
