import fs from "node:fs";
import path from "node:path";

const [extractDir, outPath] = process.argv.slice(2);
if (!extractDir || !outPath) throw new Error("Usage: node scripts/merge-dila.mjs <extractDir> <out.json>");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.toLowerCase().endsWith(".json")) out.push(full);
  }
  return out;
}

const service = [];
for (const file of walk(extractDir)) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    continue;
  }
  if (Array.isArray(parsed)) service.push(...parsed);
  else if (Array.isArray(parsed.service)) service.push(...parsed.service);
}

if (!service.length) throw new Error(`Aucun enregistrement "service" trouvé sous ${extractDir}`);
fs.writeFileSync(outPath, JSON.stringify({ service }));
console.log(`Fusionné ${service.length} enregistrements DILA dans ${outPath}`);
