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
const ICONS: Record<string, string> = {
  france_services: "FS",
  administration: "RF",
  sante: "+",
  education: "É",
  securite: "!",
  mobilite: "↔",
  quotidien: "●",
  culture: "◆",
};
const ISO: Record<number, string> = {
  5: "#087e8b",
  10: "#2f9ca5",
  15: "#78c5c9",
  30: "#c0e5e7",
};

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
    [mode, setMode] = useState<"pedestrian" | "auto">("pedestrian"),
    [duration, setDuration] = useState(10),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [panelOpen, setPanelOpen] = useState(false),
    [mapReady, setMapReady] = useState(false);
  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLocaleLowerCase("fr");
    return data.records.filter(
      (x) =>
        active.has(x.category) &&
        (!q ||
          `${x.name} ${x.typeLabel} ${x.address || ""} ${x.city || ""}`
            .toLocaleLowerCase("fr")
            .includes(q)),
    );
  }, [data, query, active]);
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
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 20,
          subdomains: "abcd",
          attribution: "© OpenStreetMap · © CARTO",
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
      mapRef.current = map;
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
      step =
        filtered.length > 6500 && map.getZoom() < 12
          ? Math.ceil(filtered.length / 6500)
          : 1;
    filtered.forEach((s, i) => {
      if (i % step) return;
      const meta = data.categories[s.category],
        marker = L.circleMarker([s.lat, s.lon], {
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
  }, [data, filtered, mapReady]);
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
  function pick() {
    if (!filtered.length) return;
    setSelected(filtered[0]);
    setPanelOpen(true);
    mapRef.current?.setView([filtered[0].lat, filtered[0].lon], 15);
  }
  function locate() {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        const s: Service = {
          id: "me",
          source: "Position de l’appareil",
          category: "mobilite",
          type: "location",
          typeLabel: "Ma position",
          name: "Autour de moi",
          lat: p.coords.latitude,
          lon: p.coords.longitude,
        };
        setSelected(s);
        setPanelOpen(true);
        mapRef.current?.setView([s.lat, s.lon], 14);
      },
      () => setError("La localisation n’a pas été autorisée."),
    );
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
          <div className="category-list">
            <div className="list-title">
              <strong>AFFICHAGE DE LA CARTE</strong>
              <div className="visibility-actions">
                <button onClick={() => setActive(new Set())}>
                  Tout masquer
                </button>
                <button onClick={() => setActive(new Set(ORDER))}>
                  Tout afficher
                </button>
              </div>
            </div>
            {data &&
              ORDER.map((k) => (
                <button
                  key={k}
                  className={active.has(k) ? "category active" : "category"}
                  onClick={() => toggle(k)}
                >
                  <i style={{ background: data.categories[k].color }}>
                    {ICONS[k]}
                  </i>
                  <span>
                    {data.categories[k].label}
                    <small>
                      {data.counts[k].toLocaleString("fr-FR")} lieux
                    </small>
                  </span>
                  <b>{active.has(k) ? "Affichés" : "Masqués"}</b>
                </button>
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
            <button onClick={recenter}>Recentrer</button>
            <button onClick={locate}>◎ Ma position</button>
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
          <span>SYNTHÈSE DÉPARTEMENTALE</span>
          <h2>Services essentiels et accessibilité · Val-d’Oise</h2>
          <p>Répartition des lieux recensés et niveau d’information pratique des fiches officielles.</p>
        </div>
        {data && synthesis ? (
          <div className="synthesis-grid">
            <section className="synthesis-kpis">
              <article><small>Lieux recensés</small><strong>{data.count.toLocaleString("fr-FR")}</strong><span>DILA et OpenStreetMap</span></article>
              <article><small>Fiches officielles</small><strong>{synthesis.official.toLocaleString("fr-FR")}</strong><span>Service-Public.gouv.fr</span></article>
              <article><small>France Services</small><strong>{data.counts.france_services.toLocaleString("fr-FR")}</strong><span>implantations officielles</span></article>
              <article><small>Catégories</small><strong>{ORDER.length}</strong><span>familles de services</span></article>
            </section>
            <section className="synthesis-chart">
              <div className="chart-title"><strong>Répartition des lieux</strong><span>par famille de services</span></div>
              {ORDER.map((key) => {
                const count = data.counts[key] || 0;
                const max = Math.max(...ORDER.map((k) => data.counts[k] || 0));
                return <div className="chart-row" key={key}><span>{data.categories[key].label}</span><div><i style={{ width: `${Math.max(1.5, count / max * 100)}%`, background: data.categories[key].color }} /></div><b>{count.toLocaleString("fr-FR")}</b></div>;
              })}
            </section>
            <section className="synthesis-chart quality-chart">
              <div className="chart-title"><strong>Informations pratiques disponibles</strong><span>parmi les fiches officielles</span></div>
              {[
                ["Téléphone", synthesis.hasPhone],
                ["Horaires", synthesis.hasHours],
                ["Site internet", synthesis.hasWebsite],
              ].map(([label, value]) => {
                const n = Number(value);
                const pct = synthesis.official ? n / synthesis.official * 100 : 0;
                return <div className="quality-row" key={String(label)}><span>{label}</span><div><i style={{ width: `${pct}%` }} /></div><b>{pct.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %</b></div>;
              })}
            </section>
            <p className="synthesis-note">État des données au {new Date(data.generatedAt).toLocaleDateString("fr-FR")} · Les évolutions correspondent aux mises à jour successives des sources officielles et contributives.</p>
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
