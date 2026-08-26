import { useEffect, useMemo, useRef } from "react";
import maplibregl, { type Map as MLMap, type Marker } from "maplibre-gl";

import { participantColor } from "./ParticipantAvatar";
import { useTheme } from "@/theme";
import type { LatLng, Vehicle } from "@/lib/konvo/types";
import type { Route } from "@/lib/konvo/route";

/**
 * O mapa do Live Konvo.
 *
 * Tiles do OpenFreeMap: sem API key, sem billing, sem cota. O basemap e claro
 * ou escuro conforme o tema — mapa branco dentro de carro a noite ofusca.
 *
 * Participantes sao marcadores HTML (avatar + cor), nao simbolos de GL: o brief
 * §11 pede pessoas, nao icones genericos de carro, e HTML e muito mais facil de
 * manter igual ao resto da interface.
 *
 * Um marcador por VEICULO, com os ocupantes empilhados — dois pinos no mesmo
 * lugar nao informam nada.
 */

const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";

interface Props {
  route: Route | null;
  vehicles: Vehicle[];
  destination: LatLng & { name: string };
  /** centraliza neste veiculo quando o mapa carrega */
  focusId?: string | null;
  className?: string;
}

export function KonvoMap({ route, vehicles, destination, focusId, className }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef<Map<string, Marker>>(new Map());
  const fitted = useRef(false);
  const { resolved } = useTheme();

  const routeGeoJSON = useMemo(() => {
    if (!route) return null;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: route.points.map((p) => [p.lng, p.lat]),
      },
    };
  }, [route]);

  // --- criar o mapa --------------------------------------------------------

  useEffect(() => {
    if (!container.current || map.current) return;

    const m = new maplibregl.Map({
      container: container.current,
      style: resolved === "dark" ? STYLE_DARK : STYLE_LIGHT,
      center: [destination.lng, destination.lat],
      zoom: 6,
      attributionControl: false,
      // Rotacionar sem querer com o polegar, dirigindo, so atrapalha.
      pitchWithRotate: false,
      dragRotate: false,
    });

    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      markers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- trocar o basemap com o tema ----------------------------------------

  const appliedTheme = useRef(resolved);

  useEffect(() => {
    const m = map.current;
    // Sem esta guarda, o primeiro render chamaria setStyle com o MESMO estilo
    // que o mapa acabou de carregar — e setStyle descarta todas as fontes e
    // camadas adicionadas, apagando a rota antes mesmo de ela aparecer.
    if (!m || appliedTheme.current === resolved) return;
    appliedTheme.current = resolved;
    m.setStyle(resolved === "dark" ? STYLE_DARK : STYLE_LIGHT);
  }, [resolved]);

  // --- rota e destino ------------------------------------------------------

  useEffect(() => {
    const m = map.current;
    if (!m || !routeGeoJSON) return;

    const draw = () => {
      if (!m.getSource("route")) {
        m.addSource("route", { type: "geojson", data: routeGeoJSON });
        m.addLayer({
          id: "route-halo",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": resolved === "dark" ? "#0b0e14" : "#ffffff",
            "line-width": 9,
            "line-opacity": 0.8,
          },
        });
        m.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": resolved === "dark" ? "#5c8aff" : "#0043fd",
            "line-width": 5,
            "line-opacity": 0.85,
          },
        });
      } else {
        (m.getSource("route") as maplibregl.GeoJSONSource).setData(routeGeoJSON);
      }
    };

    if (m.isStyleLoaded()) draw();
    // `style.load` dispara tambem depois de cada setStyle, que zera fontes e
    // camadas. Sem reagir a ele, a rota some ao trocar claro/escuro.
    m.on("style.load", draw);
    return () => {
      m.off("style.load", draw);
    };
  }, [routeGeoJSON, resolved]);

  // --- destino -------------------------------------------------------------

  useEffect(() => {
    const m = map.current;
    if (!m) return;

    const el = document.createElement("div");
    el.className = "grid size-6 place-items-center rounded-full bg-ink ring-[3px] ring-surface";
    el.innerHTML = `<span class="block size-2 rounded-full bg-surface"></span>`;

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([destination.lng, destination.lat])
      .addTo(m);

    return () => {
      marker.remove();
    };
  }, [destination.lat, destination.lng]);

  // --- veiculos ------------------------------------------------------------

  useEffect(() => {
    const m = map.current;
    if (!m) return;

    const seen = new Set<string>();

    for (const v of vehicles) {
      const pos = v.source?.fix;
      if (!pos) continue;
      seen.add(v.id);

      let marker = markers.current.get(v.id);
      if (!marker) {
        marker = new maplibregl.Marker({ element: buildMarkerEl(v) }).setLngLat([
          pos.lng,
          pos.lat,
        ]);
        marker.addTo(m);
        markers.current.set(v.id, marker);
      } else {
        marker.setLngLat([pos.lng, pos.lat]);
        updateMarkerEl(marker.getElement(), v);
      }
    }

    // Quem saiu da viagem tem que sair do mapa.
    for (const [id, marker] of markers.current) {
      if (!seen.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }
  }, [vehicles]);

  // --- enquadrar todo mundo na primeira carga ------------------------------

  useEffect(() => {
    const m = map.current;
    if (!m || fitted.current) return;

    const pts = vehicles.map((v) => v.source?.fix).filter(Boolean) as LatLng[];
    if (pts.length === 0) return;

    fitted.current = true;
    const bounds = new maplibregl.LngLatBounds();
    for (const p of pts) bounds.extend([p.lng, p.lat]);
    bounds.extend([destination.lng, destination.lat]);

    m.fitBounds(bounds, { padding: 64, maxZoom: 14, duration: 0 });
  }, [vehicles, destination]);

  // --- centralizar em alguem ----------------------------------------------

  useEffect(() => {
    const m = map.current;
    if (!m || !focusId) return;
    const pos = vehicles.find((v) => v.id === focusId)?.source?.fix;
    if (pos) m.easeTo({ center: [pos.lng, pos.lat], zoom: 13, duration: 600 });
  }, [focusId, vehicles]);

  // Posicionamento inline, e nao por classe: o CSS do MapLibre define
  // `.maplibregl-map { position: relative }` FORA de qualquer layer, e no
  // Tailwind v4 as utilities vivem em `@layer utilities` — CSS sem layer vence
  // CSS em layer, entao `absolute inset-0` seria ignorado e o mapa colapsaria
  // para altura zero. Estilo inline ganha dos dois.
  return (
    <div
      ref={container}
      className={className}
      style={{ position: "absolute", inset: 0 }}
    />
  );
}

// ---------------------------------------------------------------------------

function buildMarkerEl(v: Vehicle): HTMLElement {
  const el = document.createElement("div");
  el.className = "flex -space-x-2";
  updateMarkerEl(el, v);
  return el;
}

function updateMarkerEl(el: HTMLElement, v: Vehicle) {
  const stale = v.state === "offline";

  el.style.opacity = stale ? "0.45" : "1";
  el.innerHTML = v.occupants
    .map((o) => {
      const color = participantColor(o.colorIndex);
      const initial = (o.displayName.trim()[0] ?? "?").toUpperCase();
      return `<span
          class="grid size-8 place-items-center rounded-full text-[12px] font-bold text-white"
          style="background:${color};box-shadow:0 0 0 2.5px var(--color-surface),0 1px 3px rgb(0 0 0 / .3)"
        >${initial}</span>`;
    })
    .join("");
}
