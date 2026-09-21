"use client";
import { useEffect, useMemo, useRef, useState } from "react";
type Opening = {
  nom_jour_debut?: string;
  nom_jour_fin?: string;
  valeur_heure_debut_1?: string;
  valeur_heure_fin_1?: string;
  valeur_heure_debut_2?: string;
  valeur_heure_fin_2?: string;
  commentaire?: string;
};
type Service = {
  id: string;
  source: string;
  category: string;
  type: string;
  typeLabel: string;
  name: string;
  lat: number;
  lon: number;
  address?: string;
  city?: string;
  phone?: string[];
  email?: string[];
  website?: string[];
  opening?: Opening[];
  openingText?: string;
  openingHours?: string;
  wheelchair?: string;
  operator?: string;
  mission?: string;
  description?: string;
  updated?: string;
  officialUrl?: string;
  osmUrl?: string;
};
type Dataset = {
  generatedAt: string;
  count: number;
  counts: Record<string, number>;
  categories: Record<string, { label: string; color: string }>;
  records: Service[];
};
const ORDER = [
  "france_services",
  "administration",
  "sante",
  "education",
  "securite",
  "mobilite",
  "quotidien",
  "culture",
];
const GROUPS: { label: string; keys: string[] }[] = [
  { label: "Accueil & démarches", keys: ["france_services", "administration"] },
  { label: "Santé & éducation", keys: ["sante", "education"] },
  { label: "Sécurité & mobilité", keys: ["securite", "mobilite"] },
  { label: "Quotidien & culture", keys: ["quotidien", "culture"] },
];
const QUOTIDIEN_GROUPS: { key: string; label: string; types: string[] }[] = [
  {
    key: "alimentation",
    label: "Alimentation & commerces",
    types: ["convenience", "supermarket", "bakery", "marketplace", "cafe", "teahouse", "restaurant", "bar"],
  },
  { key: "banque", label: "Banque & argent", types: ["bank", "atm"] },
  { key: "poste", label: "Poste & courrier", types: ["post_office", "post_box"] },
];
const ISO: Record<number, string> = {
  5: "#087e8b",
  10: "#2f9ca5",
  15: "#78c5c9",
  30: "#c0e5e7",
};
const ICON_SVG_INNER: Record<string, string> = {
  france_services:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2.3" x2="12" y2="6.3"/><line x1="12" y1="17.7" x2="12" y2="21.7"/><line x1="2.3" y1="12" x2="6.3" y2="12"/><line x1="17.7" y1="12" x2="21.7" y2="12"/>',
  administration:
    '<path d="M3 10 12 4 21 10"/><line x1="3" y1="21" x2="21" y2="21"/><line x1="5" y1="21" x2="5" y2="10"/><line x1="9" y1="21" x2="9" y2="10"/><line x1="15" y1="21" x2="15" y2="10"/><line x1="19" y1="21" x2="19" y2="10"/>',
  sante:
    '<circle cx="12" cy="12" r="9"/><line x1="12" y1="7.5" x2="12" y2="16.5"/><line x1="7.5" y1="12" x2="16.5" y2="12"/>',
  education:
    '<path d="M3 6c3-1.5 6-1.5 9 0v13c-3-1.5-6-1.5-9 0V6Z"/><path d="M21 6c-3-1.5-6-1.5-9 0v13c3-1.5 6-1.5 9 0V6Z"/>',
  securite:
    '<path d="M12 2 20 5v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V5l8-3Z"/><path d="M8.5 12.3 10.8 14.6 15.3 10"/>',
  mobilite:
    '<rect x="4" y="5.5" width="16" height="11" rx="2.5"/><line x1="4" y1="11.5" x2="20" y2="11.5"/><line x1="8" y1="5.5" x2="8" y2="11.5"/><line x1="16" y1="5.5" x2="16" y2="11.5"/><circle cx="8" cy="18.5" r="1.4"/><circle cx="16" cy="18.5" r="1.4"/>',
  quotidien: '<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  culture:
    '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2.1 0-.8-.5-1.4-.5-2.2 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8Z"/><circle cx="8.3" cy="10.5" r="0.9" fill="#fff" stroke="none"/><circle cx="12" cy="7.8" r="0.9" fill="#fff" stroke="none"/><circle cx="15.7" cy="10.5" r="0.9" fill="#fff" stroke="none"/><circle cx="9.3" cy="15" r="0.9" fill="#fff" stroke="none"/>',
};
function pinIconHtml(category: string, color: string) {
  const inner = ICON_SVG_INNER[category] || "";
  return `<span style="background:${color}"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg></span>`;
}
const PIN_ZOOM_THRESHOLD = 14;

export default function Home() {
  const mapEl = useRef<HTMLDivElement>(null),
    mapRef = useRef<any>(null),
    pointsRef = useRef<any>(null),
    isoRef = useRef<any>(null),
    focusRef = useRef<any>(null),
    territoryBoundsRef = useRef<any>(null),
    synthesisRef = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<Dataset | null>(null),
    [selected, setSelected] = useState<Service | null>(null),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(new Set(ORDER)),
    [hiddenTypes, setHiddenTypes] = useState(new Set<string>()),
    [mode, setMode] = useState<"pedestrian" | "auto">("pedestrian"),
    [duration, setDuration] = useState(10),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [panelOpen, setPanelOpen] = useState(false),
    [mapReady, setMapReady] = useState(false),
    [zoom, setZoom] = useState(10);
  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLocaleLowerCase("fr");
    return data.records.filter(
      (x) =>
        active.has(x.category) &&
        !hiddenTypes.has(x.type) &&
        (!q ||
          `${x.name} ${x.typeLabel} ${x.address || ""} ${x.city || ""}`
            .toLocaleLowerCase("fr")
            .includes(q)),
    );
  }, [data, query, active, hiddenTypes]);
  const quotidienBreakdown = useMemo(() => {
    if (!data) return [];
    const groups = QUOTIDIEN_GROUPS.map((g) => ({ ...g, count: 0 }));
    const autresTypes = new Set<string>();
    let autresCount = 0;
    for (const r of data.records) {
      if (r.category !== "quotidien") continue;
      const g = groups.find((g) => g.types.includes(r.type));
      if (g) g.count++;
      else {
        autresCount++;
        autresTypes.add(r.type);
      }
    }
    return [...groups, { key: "autres", label: "Autres services", types: [...autresTypes], count: autresCount }];
  }, [data]);
  const dataAgeDays = useMemo(() => {
    if (!data) return null;
    return Math.floor((Date.now() - new Date(data.generatedAt).getTime()) / 86400000);
  }, [data]);
  const synthesis = useMemo(() => {
    if (!data) return null;
    const official = data.records.filter((x) => x.source.includes("DILA"));
    const hasPhone = official.filter((x) => x.phone?.length).length;
    const hasHours = official.filter(
      (x) => x.opening?.length || x.openingHours || x.openingText,
    ).length;
    const hasWebsite = official.filter((x) => x.website?.length).length;
    return { official: official.length, hasPhone, hasHours, hasWebsite };
  }, [data]);
  useEffect(() => {
    fetch("./data/services-95.json")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("Les données ne peuvent pas être chargées."));
  }, []);
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      const L = (window as any).L;
      if (!L || !mapEl.current) return;
      const map = L.map(mapEl.current, {
        zoomControl: false,
        preferCanvas: true,
        minZoom: 7,
        maxZoom: 15,
      }).setView([49.075, 2.1], 10);
      L.control.zoom({ position: "bottomleft" }).addTo(map);
      L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution: "© OpenStreetMap contributors",
        },
      ).addTo(map);
      const boundaryPane = map.createPane("departmentBoundary");
      boundaryPane.style.zIndex = "390";
      boundaryPane.style.pointerEvents = "none";
      fetch("./data/departement95.geojson")
        .then((response) => response.json())
        .then((department) => {
          const territory = L.geoJSON(department, {
            pane: "departmentBoundary",
            renderer: L.svg({ pane: "departmentBoundary" }),
            style: {
              color: "#000091",
              weight: 2,
              fill: false,
              opacity: 0.55,
            },
            interactive: false,
          }).addTo(map);
          territoryBoundsRef.current = territory.getBounds();
          map.fitBounds(territory.getBounds(), {
            padding: [0, 0],
            animate: false,
          });
        })
        .catch(() => map.setView([49.075, 2.1], 10, { animate: false }));
      map.on("click", (e: any) => {
        setSelected({
          id: "location",
          source: "Point choisi sur la carte",
          category: "mobilite",
          type: "location",
          typeLabel: "Lieu à analyser",
          name: "Point d’accessibilité",
          lat: e.latlng.lat,
          lon: e.latlng.lng,
        });
        setPanelOpen(true);
      });
      map.on("zoomend", () => setZoom(map.getZoom()));
      mapRef.current = map;
      setZoom(map.getZoom());
      setMapReady(true);
    };
    document.body.appendChild(script);
  }, []);
  useEffect(() => {
    const L = (window as any).L,
      map = mapRef.current;
    if (!L || !map || !data) return;
    if (pointsRef.current) map.removeLayer(pointsRef.current);
    const group = L.layerGroup(),
      renderer = L.canvas({ padding: 0.5 }),
      showPins = zoom >= PIN_ZOOM_THRESHOLD,
      step =
        !showPins && filtered.length > 6500 && zoom < 12
          ? Math.ceil(filtered.length / 6500)
          : 1;
    filtered.forEach((s, i) => {
      if (i % step) return;
      const meta = data.categories[s.category],
        marker = showPins
          ? L.marker([s.lat, s.lon], {
              icon: L.divIcon({
                className: "service-pin",
                html: pinIconHtml(s.category, meta.color),
                iconSize: [26, 26],
                iconAnchor: [13, 13],
              }),
            })
          : L.circleMarker([s.lat, s.lon], {
              radius: s.source.includes("DILA") ? 5.5 : 4,
              color: "#fff",
              weight: 1.2,
              fillColor: meta.color,
              fillOpacity: 0.9,
              renderer,
            });
      marker.bindTooltip(
        `<strong>${esc(s.name)}</strong><br>${esc(s.typeLabel)}`,
        { direction: "top", className: "service-tooltip" },
      );
      marker.on("click", (e: any) => {
        L.DomEvent.stopPropagation(e);
        setSelected(s);
        setPanelOpen(true);
      });
      marker.on("mouseover", () => {
        map.getContainer().style.cursor = "pointer";
      });
      marker.on("mouseout", () => {
        map.getContainer().style.cursor = "";
      });
      marker.addTo(group);
    });
    group.addTo(map);
    pointsRef.current = group;
  }, [data, filtered, mapReady, zoom]);
  useEffect(() => {
    const L = (window as any).L,
      map = mapRef.current;
    if (!L || !map || !selected) return;
    if (focusRef.current) map.removeLayer(focusRef.current);
    focusRef.current = L.circleMarker([selected.lat, selected.lon], {
      radius: 10,
      color: "#101b39",
      weight: 3,
      fillColor: "#fff",
      fillOpacity: 1,
    }).addTo(map);
    map.panTo([selected.lat, selected.lon], { animate: true });
    setError("");
  }, [selected]);
  function toggle(k: string) {
    setActive((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  }
  function toggleTypes(types: string[]) {
    setHiddenTypes((prev) => {
      const n = new Set(prev);
      const allHidden = types.every((t) => n.has(t));
      for (const t of types) (allHidden ? n.delete(t) : n.add(t));
      return n;
    });
  }
  function pick() {
    if (!filtered.length) return;
    setSelected(filtered[0]);
    setPanelOpen(true);
    mapRef.current?.setView([filtered[0].lat, filtered[0].lon], 15);
  }
  function recenter() {
    clearIso();
    setPanelOpen(false);
    setSelected(null);
    if (focusRef.current && mapRef.current) {
      mapRef.current.removeLayer(focusRef.current);
      focusRef.current = null;
    }
    if (territoryBoundsRef.current) {
      mapRef.current?.fitBounds(territoryBoundsRef.current, {
        padding: [0, 0],
        animate: false,
      });
    } else {
      mapRef.current?.setView([49.075, 2.1], 10, { animate: false });
    }
  }
  function changeIsoMode(next: "pedestrian" | "auto") {
    setMode(next);
    setDuration(next === "pedestrian" ? 10 : 15);
  }
  async function isochrones() {
    if (!selected) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch("https://valhalla1.openstreetmap.de/isochrone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locations: [{ lat: selected.lat, lon: selected.lon }],
          costing: mode,
          contours: [{ time: duration, color: ISO[duration].slice(1) }],
          polygons: true,
          denoise: 1,
          generalize: 20,
        }),
      });
      if (!r.ok) throw new Error();
      const geo = await r.json(),
        L = (window as any).L,
        map = mapRef.current;
      if (isoRef.current) map.removeLayer(isoRef.current);
      isoRef.current = L.geoJSON(geo, {
        style: (f: any) => ({
          color: ISO[Number(f.properties?.contour)] || "#087e8b",
          weight: 2,
          fillColor: ISO[Number(f.properties?.contour)] || "#087e8b",
          fillOpacity: 0.16,
        }),
      }).addTo(map);
      map.fitBounds(isoRef.current.getBounds(), { padding: [35, 35] });
    } catch {
      setError(
        "Le calcul réseau est momentanément indisponible. Réessayez dans quelques instants.",
      );
    } finally {
      setLoading(false);
    }
  }
  function clearIso() {
    if (isoRef.current && mapRef.current)
      mapRef.current.removeLayer(isoRef.current);
    isoRef.current = null;
  }
  function closePanel(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    clearIso();
    setPanelOpen(false);
    setSelected(null);
    setError("");
    if (focusRef.current && mapRef.current) {
      mapRef.current.removeLayer(focusRef.current);
      focusRef.current = null;
    }
    window.setTimeout(() => mapRef.current?.invalidateSize(false), 320);
  }
  return (
    <main className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="https://ddt95.github.io/atlas-territorial-95/"
        >
          <img
            src="./prefet-val-doise.svg"
            alt="Préfet du Val-d’Oise — Liberté, Égalité, Fraternité"
          />
        </a>
        <div className="title">
          <small>SERVICES ESSENTIELS · VAL-D’OISE</small>
          <h1>Services essentiels & accessibilité</h1>
          <p>
            <strong>Val-d’Oise</strong> · services publics · santé · éducation ·
            mobilités · vie quotidienne
          </p>
        </div>
        <button
          className="headline-count data-button"
          type="button"
          onClick={() => synthesisRef.current?.showModal()}
        >
          <i />
          <div>
            <strong>Données & évolutions</strong>
            <span>Synthèse départementale</span>
          </div>
        </button>
      </header>
      <div className="progress">
        <span />
      </div>
      <section className="workspace">
        <aside className="filters">
          <div className="intro">
            <span className="kicker">RECHERCHER ET COMPRENDRE</span>
            <h2>
              Un service
              <br />
              <span>près de chez vous</span>
            </h2>
            <p>
              Recherchez un lieu, filtrez les services, puis cliquez sur un
              point pour ouvrir sa fiche complète.
            </p>
          </div>
          <form
            className="search"
            onSubmit={(e) => {
              e.preventDefault();
              pick();
            }}
          >
            <label htmlFor="search">Service, équipement ou commune</label>
            <div>
              <input
                id="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Mairie, pharmacie, Argenteuil…"
              />
              <button>Rechercher</button>
            </div>
            <small>
              {filtered.length.toLocaleString("fr-FR")} résultat(s) affiché(s)
            </small>
          </form>
          <div className="quick-actions">
            <button type="button" onClick={recenter}>Recentrer</button>
            <button
              type="button"
              onClick={() => synthesisRef.current?.showModal()}
            >
              Données & évolutions
            </button>
          </div>
          <div className="category-list">
            <div className="list-title">
              <strong>AFFICHAGE DE LA CARTE</strong>
              <div className="visibility-actions">
                <button onClick={() => setActive(new Set())}>
                  Tout masquer
                </button>
                <button
                  onClick={() => {
                    setActive(new Set(ORDER));
                    setHiddenTypes(new Set());
                  }}
                >
                  Tout afficher
                </button>
              </div>
            </div>
            {data &&
              GROUPS.map((group) => (
                <div className="category-group" key={group.label}>
                  <span className="group-label">{group.label}</span>
                  {group.keys.map((k) => (
                    <div key={k}>
                      <button
                        className={active.has(k) ? "category active" : "category"}
                        onClick={() => toggle(k)}
                      >
                        <i style={{ background: data.categories[k].color }}>
                          <CategoryIcon k={k} />
                        </i>
                        <span>
                          {data.categories[k].label}
                          <small>
                            {data.counts[k].toLocaleString("fr-FR")} lieux
                          </small>
                        </span>
                        <b>{active.has(k) ? "Affichés" : "Masqués"}</b>
                      </button>
                      {k === "quotidien" && (
                        <div className="subtype-list">
                          {quotidienBreakdown.map((g) => {
                            const isVisible = !g.types.length || !g.types.every((t) => hiddenTypes.has(t));
                            return (
                              <button
                                key={g.key}
                                type="button"
                                className={isVisible ? "subtype-chip active" : "subtype-chip"}
                                onClick={() => toggleTypes(g.types)}
                              >
                                <span>{g.label}</span>
                                <b>{g.count.toLocaleString("fr-FR")}</b>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
          </div>
          <div className="source-note">
            <strong>Sources mobilisées</strong>
            <span>Service‑Public.gouv.fr / DILA · OpenStreetMap</span>
            <small>
              Mise à jour locale :{" "}
              {data
                ? new Date(data.generatedAt).toLocaleDateString("fr-FR")
                : "…"}
              {dataAgeDays !== null && dataAgeDays > 30
                ? ` · à vérifier (${dataAgeDays} j)`
                : ""}
            </small>
          </div>
        </aside>
        <section className="map-wrap">
          <div
            ref={mapEl}
            className="map"
            aria-label="Carte des services essentiels du Val-d’Oise"
          />
          <div className="map-tools">
            <span>Cliquez sur la carte pour analyser un lieu</span>
          </div>
          <div className="map-legend">
            <strong>{filtered.length.toLocaleString("fr-FR")}</strong>
            <span>points dans la sélection</span>
          </div>
        </section>
        <aside className={panelOpen ? "details open" : "details"}>
          <button className="close-panel" onClick={closePanel}>
            ×
          </button>
          {selected ? (
            <Panel
              service={selected}
              categories={data?.categories || {}}
              mode={mode}
              duration={duration}
              loading={loading}
              error={error}
              onIso={isochrones}
              onMode={changeIsoMode}
              onDuration={setDuration}
              onClear={clearIso}
            />
          ) : null}
        </aside>
      </section>
      <footer>
        <span>
          <b>{data ? data.count.toLocaleString("fr-FR") : "…"} lieux</b> · données locales consolidées
        </span>
        <span>DDT Val-d’Oise · Leaflet 1.9.4 · OSM</span>
      </footer>
      <dialog ref={synthesisRef} className="synthesis-dialog">
        <button
          className="dialog-close"
          aria-label="Fermer la synthèse"
          onClick={() => synthesisRef.current?.close()}
        >
          ×
        </button>
        <div className="synthesis-head">
          <span>COMPRENDRE LA CARTE</span>
          <h2>Vos services sont-ils réellement accessibles ?</h2>
          <p>Une méthode simple pour lire la carte, tester un trajet et repérer une fragilité territoriale.</p>
        </div>
        {data && synthesis ? (
          <div className="pedagogy-grid">
            <section className="pedagogy-steps">
              <article><b>1</b><div><strong>Choisissez un besoin</strong><p>Masquez les autres catégories pour éviter de confondre abondance de points et accès au service recherché.</p></div></article>
              <article><b>2</b><div><strong>Cliquez sur un service ou un lieu</strong><p>La fiche donne l’adresse, le téléphone, les horaires connus et le lien vers la source.</p></div></article>
              <article><b>3</b><div><strong>Calculez un temps d’accès</strong><p>Comparez 5, 10 ou 15 minutes à pied, puis 10, 15 ou 30 minutes en voiture.</p></div></article>
              <article><b>4</b><div><strong>Vérifiez avant de partir</strong><p>Un horaire absent ou ancien doit être confirmé par téléphone ou sur le site officiel.</p></div></article>
            </section>
            <section className="pedagogy-card fragility-card">
              <span>REPÉRER UNE FRAGILITÉ</span>
              <h3>Trois signaux à regarder</h3>
              <ul>
                <li><strong>Éloignement :</strong> aucun service utile dans l’isochrone piéton de 15 minutes.</li>
                <li><strong>Dépendance automobile :</strong> le service apparaît seulement avec le calcul en voiture.</li>
                <li><strong>Information incomplète :</strong> horaires ou contact absents, rendant le déplacement incertain.</li>
              </ul>
            </section>
            <section className="pedagogy-card quality-chart">
              <div className="chart-title"><strong>Peut-on préparer son déplacement ?</strong><span>part des fiches officielles renseignées</span></div>
              {[
                ["Téléphone", synthesis.hasPhone],
                ["Horaires", synthesis.hasHours],
                ["Site internet", synthesis.hasWebsite],
              ].map(([label, value]) => {
                const n = Number(value);
                const pct = synthesis.official ? n / synthesis.official * 100 : 0;
                return <div className="quality-row" key={String(label)}><span>{label}</span><div><i style={{ width: `${pct}%` }} /></div><b>{pct.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %</b></div>;
              })}
              <p className="quality-explain">Les horaires sont l’information la moins souvent publiée : mieux vaut vérifier avant un déplacement.</p>
            </section>
            <section className="pedagogy-card caution-card">
              <span>BIEN INTERPRÉTER</span>
              <h3>Un point n’est pas une capacité d’accueil</h3>
              <p>La carte indique une implantation, pas le nombre d’agents, les délais de rendez-vous, la qualité de l’accueil ni la fréquentation.</p>
              <p>Les arrêts de transport sont nombreux : leur volume ne doit pas masquer la rareté d’un service administratif, médical ou social.</p>
            </section>
            <section className="pedagogy-card france-card">
              <span>FRANCE SERVICES</span>
              <h3>{data.counts.france_services} lieux pour accompagner les démarches</h3>
              <p>Utilisez le filtre dédié pour trouver un accompagnement administratif polyvalent, puis consultez les horaires et le téléphone de chaque implantation.</p>
            </section>
            <p className="synthesis-note">Sources mises à jour au {new Date(data.generatedAt).toLocaleDateString("fr-FR")} · Isochrones indicatifs calculés sur le réseau OpenStreetMap.</p>
          </div>
        ) : null}
      </dialog>
    </main>
  );
}
function Panel({
  service,
  categories,
  mode,
  duration,
  loading,
  error,
  onIso,
  onMode,
  onDuration,
  onClear,
}: {
  service: Service;
  categories: Record<string, { label: string; color: string }>;
  mode: "pedestrian" | "auto";
  duration: number;
  loading: boolean;
  error: string;
  onIso: () => void;
  onMode: (m: "pedestrian" | "auto") => void;
  onDuration: (minutes: number) => void;
  onClear: () => void;
}) {
  const meta = categories[service.category] || {
    label: "Lieu",
    color: "#087e8b",
  };
  return (
    <div className="detail-content">
      <div className="detail-head" style={{ borderColor: meta.color }}>
        <span style={{ color: meta.color }}>{meta.label}</span>
        <h2>{service.name}</h2>
        <p>
          {service.typeLabel}
          {service.operator ? ` · ${service.operator}` : ""}
        </p>
      </div>
      {service.address && (
        <Info label="Adresse">
          <p>{service.address}</p>
          <a
            href={`https://www.openstreetmap.org/directions?to=${service.lat},${service.lon}`}
            target="_blank"
          >
            Itinéraire ↗
          </a>
        </Info>
      )}
      {service.phone?.length ||
      service.email?.length ||
      service.website?.length ? (
        <Info label="Contacts">
          <div className="contact-list">
            {service.phone?.map((x) => (
              <a key={x} href={`tel:${x.replace(/\s/g, "")}`}>
                ☎ {x}
              </a>
            ))}
            {service.email?.map((x) => (
              <a key={x} href={`mailto:${x}`}>
                ✉ {x}
              </a>
            ))}
            {service.website?.map((x) => (
              <a key={x} href={url(x)} target="_blank">
                Site internet ↗
              </a>
            ))}
          </div>
        </Info>
      ) : null}
      {service.opening?.length ||
      service.openingHours ||
      service.openingText ? (
        <Info label="Horaires d’ouverture">
          {service.opening?.map((r, i) => (
            <div className="hours" key={i}>
              <b>
                {r.nom_jour_debut}
                {r.nom_jour_fin && r.nom_jour_fin !== r.nom_jour_debut
                  ? ` → ${r.nom_jour_fin}`
                  : ""}
              </b>
              <span>{hours(r)}</span>
              {r.commentaire && <small>{r.commentaire}</small>}
            </div>
          ))}
          {service.openingHours && (
            <p className="osm-hours">{service.openingHours}</p>
          )}
          {service.openingText && <small>{service.openingText}</small>}
        </Info>
      ) : (
        <Info label="Horaires">
          <p className="muted">Non renseignés par la source.</p>
        </Info>
      )}
      {service.wheelchair && (
        <Info label="Accessibilité">
          <p>
            {service.wheelchair === "yes"
              ? "Accessible en fauteuil roulant"
              : service.wheelchair === "limited"
                ? "Accessibilité partielle"
                : service.wheelchair === "no"
                  ? "Non accessible en fauteuil roulant"
                  : service.wheelchair}
          </p>
        </Info>
      )}
      <section className="iso-card">
        <span>ACCESSIBILITÉ DU LIEU</span>
        <h3>Jusqu’où va-t-on en quelques minutes ?</h3>
        <div className="mode-tabs">
          <button
            className={mode === "pedestrian" ? "active" : ""}
            onClick={() => onMode("pedestrian")}
          >
            À pied
          </button>
          <button
            className={mode === "auto" ? "active" : ""}
            onClick={() => onMode("auto")}
          >
            En voiture
          </button>
        </div>
        <div className="duration-picker" aria-label="Durée de l’isochrone">
          {(mode === "pedestrian" ? [5, 10, 15] : [10, 15, 30]).map(
            (minutes) => (
              <button
                key={minutes}
                className={duration === minutes ? "active" : ""}
                onClick={() => onDuration(minutes)}
              >
                {minutes} min
              </button>
            ),
          )}
        </div>
        <button
          className="calculate"
          onClick={onIso}
          disabled={loading}
        >
          {loading ? "Calcul du réseau…" : `Afficher ${duration} min`}
        </button>
        <button className="clear" onClick={onClear}>
          Effacer les zones
        </button>
        {error && <p className="iso-error">{error}</p>}
        <small>
          Calcul fondé sur le réseau OpenStreetMap. Les temps restent
          indicatifs.
        </small>
      </section>
      <section className="provenance">
        <strong>Source</strong>
        <span>{service.source}</span>
        {service.updated && (
          <small>Fiche mise à jour le {service.updated}</small>
        )}
        <div>
          {service.officialUrl && (
            <a href={service.officialUrl} target="_blank">
              Fiche officielle ↗
            </a>
          )}
          {service.osmUrl && (
            <a href={service.osmUrl} target="_blank">
              Voir dans OSM ↗
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
function Info({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="info-block">
      <strong>{label}</strong>
      {children}
    </section>
  );
}
function hours(r: Opening) {
  const a =
      r.valeur_heure_debut_1 && r.valeur_heure_fin_1
        ? `${r.valeur_heure_debut_1.slice(0, 5)}–${r.valeur_heure_fin_1.slice(0, 5)}`
        : "",
    b =
      r.valeur_heure_debut_2 && r.valeur_heure_fin_2
        ? `${r.valeur_heure_debut_2.slice(0, 5)}–${r.valeur_heure_fin_2.slice(0, 5)}`
        : "";
  return [a, b].filter(Boolean).join(" · ") || "Sur rendez-vous";
}
function CategoryIcon({ k }: { k: string }) {
  const inner = ICON_SVG_INNER[k];
  if (!inner) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={17}
      height={17}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
function url(x: string) {
  return /^https?:\/\//i.test(x) ? x : `https://${x}`;
}
function esc(x: string) {
  return x.replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        c
      ] || c,
  );
}
