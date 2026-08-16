import fs from "node:fs";
import path from "node:path";

const [dilaPath, osmPath] = process.argv.slice(2);
if (!dilaPath || !osmPath) throw new Error("Usage: node scripts/build-data.mjs <dila.json> <osm.json>");

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "public", "data");
fs.mkdirSync(outDir, { recursive: true });

const dila = JSON.parse(fs.readFileSync(dilaPath, "utf8")).service || [];
const osm = JSON.parse(fs.readFileSync(osmPath, "utf8")).elements || [];

const CATEGORY = {
  france_services: { label: "France Services", color: "#000091" },
  administration: { label: "Administration & droits", color: "#3153a4" },
  sante: { label: "Santé & solidarité", color: "#d33b63" },
  education: { label: "Éducation & enfance", color: "#7b4bb7" },
  securite: { label: "Sécurité & secours", color: "#d65b2b" },
  mobilite: { label: "Mobilité", color: "#087e8b" },
  quotidien: { label: "Services du quotidien", color: "#b07800" },
  culture: { label: "Culture & sport", color: "#33845b" },
};

function compact(values) { return values.filter(Boolean); }
function first(value) { return Array.isArray(value) ? value[0] : value; }
function norm(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function distance(a, b) {
  const r = Math.PI / 180;
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371000;
}
function publicCategory(type = "") {
  const t = norm(type);
  if (/france services/.test(t)) return "france_services";
  if (/police|gendarmer|sapeur|pompier|securite|penitentiaire/.test(t)) return "securite";
  if (/sante|hopital|medical|pharm|social|caf|cpam|msa|handicap|retraite|emploi|mission locale/.test(t)) return "sante";
  if (/ecole|college|lycee|univers|education|creche|enfance|cio/.test(t)) return "education";
  if (/culture|bibliothe|musee|sport/.test(t)) return "culture";
  if (/transport|gare|mobilite/.test(t)) return "mobilite";
  return "administration";
}
function osmCategory(tags) {
  const a = tags.amenity || "", h = tags.healthcare || "", s = tags.shop || "", l = tags.leisure || "", t = tags.tourism || "";
  if (h || /hospital|clinic|doctors|dentist|pharmacy|nursing_home|social_facility|veterinary/.test(a)) return "sante";
  if (/school|kindergarten|college|university|childcare/.test(a)) return "education";
  if (/police|fire_station|rescue_station/.test(a)) return "securite";
  if (tags.public_transport || /bus_station|taxi|bicycle_rental|charging_station|fuel/.test(a)) return "mobilite";
  if (s || /marketplace|post_box|post_office|bank|atm/.test(a)) return "quotidien";
  if (l || t || /library|theatre|cinema|arts_centre|community_centre/.test(a)) return "culture";
  if (/townhall|courthouse|public_building|social_centre/.test(a) || tags.office === "government") return "administration";
  return null;
}
function typeLabel(tags) {
  const value = tags.amenity || tags.healthcare || tags.public_transport || tags.shop || tags.leisure || tags.tourism || tags.office || "service";
  const labels = { townhall: "Mairie", post_office: "Bureau de poste", post_box: "Boîte postale", police: "Police", fire_station: "Centre de secours", courthouse: "Tribunal", school: "École", kindergarten: "École maternelle", college: "Établissement d’enseignement", university: "Enseignement supérieur", childcare: "Accueil de la petite enfance", hospital: "Hôpital", clinic: "Clinique", doctors: "Médecin", dentist: "Dentiste", pharmacy: "Pharmacie", nursing_home: "Établissement pour personnes âgées", social_facility: "Établissement social", library: "Bibliothèque", theatre: "Théâtre", cinema: "Cinéma", arts_centre: "Centre culturel", community_centre: "Maison de quartier", sports_centre: "Centre sportif", sports_hall: "Salle de sport", swimming_pool: "Piscine", stadium: "Stade", bus_station: "Gare routière", platform: "Arrêt de transport", stop_position: "Arrêt de transport", charging_station: "Borne de recharge", bicycle_rental: "Vélos en libre-service", supermarket: "Supermarché", convenience: "Commerce de proximité", bakery: "Boulangerie", bank: "Banque", atm: "Distributeur", marketplace: "Marché", government: "Service public" };
  return labels[value] || value.replaceAll("_", " ").replace(/^./, c => c.toUpperCase());
}

const records = [];
for (const item of dila) {
  const address = first(item.adresse) || {};
  const insee = String(item.code_insee_commune || first(item.pivot)?.code_insee_commune?.[0] || "");
  const postcode = String(address.code_postal || "");
  const lat = Number(address.latitude), lon = Number(address.longitude);
  if (!(insee.startsWith("95") || /^95\d{3}$/.test(postcode)) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  const type = first(item.pivot)?.type_service_local || item.type_organisme || "service-public";
  records.push({
    id: `dila-${item.id}`,
    source: "Service-Public.gouv.fr / DILA",
    category: publicCategory(type),
    type,
    typeLabel: type === "france_services" ? "France Services" : type.replaceAll("-", " ").replace(/^./, c => c.toUpperCase()),
    name: item.nom || item.sigle || "Service public",
    lat, lon,
    address: compact([address.numero_voie, address.complement1, `${address.code_postal || ""} ${address.nom_commune || ""}`.trim()]).join(", "),
    city: address.nom_commune || "",
    postcode,
    phone: (item.telephone || []).map(x => x.valeur).filter(Boolean),
    email: item.adresse_courriel || [],
    website: (item.site_internet || []).map(x => x.valeur).filter(Boolean),
    opening: item.plage_ouverture || [],
    openingText: item.commentaire_plage_ouverture || "",
    access: item.telephone_accessible || [],
    contactForm: (item.formulaire_contact || []).map(x => x.valeur || x).filter(Boolean),
    online: item.sve || [],
    mission: item.mission || item.information_complementaire || "",
    updated: item.date_modification || item.date_diffusion || "",
    officialUrl: item.url_service_public || "",
    siren: item.siren || "",
    siret: item.siret || "",
  });
}

const official = [...records];
for (const element of osm) {
  const tags = element.tags || {};
  const category = osmCategory(tags);
  if (!category) continue;
  const lat = Number(element.lat ?? element.center?.lat), lon = Number(element.lon ?? element.center?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  const name = tags.name || tags.official_name || typeLabel(tags);
  const duplicate = official.some(x => x.category === category && distance({ lat, lon }, x) < 55 && (norm(x.name).includes(norm(name)) || norm(name).includes(norm(x.name)) || category === "administration"));
  if (duplicate) continue;
  const street = compact([tags["addr:housenumber"], tags["addr:street"]]).join(" ");
  records.push({
    id: `osm-${element.type}-${element.id}`,
    source: "OpenStreetMap",
    category,
    type: tags.amenity || tags.healthcare || tags.public_transport || tags.shop || tags.leisure || tags.tourism || tags.office || "service",
    typeLabel: typeLabel(tags),
    name,
    lat, lon,
    address: compact([street, tags["addr:postcode"], tags["addr:city"]]).join(" "),
    city: tags["addr:city"] || "",
    postcode: tags["addr:postcode"] || "",
    phone: compact([tags.phone, tags["contact:phone"]]),
    email: compact([tags.email, tags["contact:email"]]),
    website: compact([tags.website, tags["contact:website"]]),
    openingHours: tags.opening_hours || "",
    wheelchair: tags.wheelchair || "",
    operator: tags.operator || tags.brand || "",
    description: tags.description || "",
    osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
  });
}

records.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, "fr"));
const counts = Object.fromEntries(Object.keys(CATEGORY).map(key => [key, records.filter(x => x.category === key).length]));
fs.writeFileSync(path.join(outDir, "services-95.json"), JSON.stringify({ generatedAt: new Date().toISOString(), count: records.length, counts, categories: CATEGORY, records }));
console.log(JSON.stringify({ total: records.length, official: official.length, osm: records.length - official.length, counts }, null, 2));
