import { useEffect, useMemo, useRef } from "react";
import maplibregl, { type Map as MLMap, type Marker } from "maplibre-gl";

import { buildVehicleMarker, updateVehicleMarker } from "./vehicleMarker";
import { useTheme } from "@/theme";
import type { LatLng, Vehicle } from "@/lib/konvo/types";
import { bearingAt, type Route } from "@/lib/konvo/route";

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

/**
 * Como a camera olha o mapa.
 *
 * `overview` mostra a rota inteira de cima — bom para entender onde o grupo
 * esta no trajeto. `follow` gruda atras do proprio carro, inclinada, como um
 * app de navegacao: e a visao util em movimento, porque o que vem pela frente
 * fica em cima da tela.
 */
export type CameraMode = "overview" | "follow";

interface Props {
  route: Route | null;
  vehicles: Vehicle[];
  destination: LatLng & { name: string };
  camera?: CameraMode;
  /** veiculo que a camera segue no modo `follow` */
  followId?: string | null;
  /** desenha um anel a mais no proprio veiculo */
  meId?: string | null;
  className?: string;
}

export function KonvoMap({
  route,
  vehicles,
  destination,
  camera = "overview",
  followId,
  meId,
  className,
}: Props) {
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

    // Handle de depuracao, so em desenvolvimento: permite inspecionar camera,
    // camadas e fontes do console sem instrumentar o componente toda vez.
    if (import.meta.env.DEV) {
      (window as unknown as { __konvoMap?: MLMap }).__konvoMap = m;
    }

    return () => {
      m.remove();
      map.current = null;
      markers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- trocar o basemap com o tema ----------------------------------------

  const appliedTheme = useRef(resolved);
  /** ja animamos a entrada no modo seguir? */
  const enteredFollow = useRef(false);

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
        marker = new maplibregl.Marker({ element: buildVehicleMarker(v) }).setLngLat([
          pos.lng,
          pos.lat,
        ]);
        marker.addTo(m);
        markers.current.set(v.id, marker);
      } else {
        marker.setLngLat([pos.lng, pos.lat]);
        updateVehicleMarker(marker.getElement(), v, v.id === meId);
      }
    }

    // Quem saiu da viagem tem que sair do mapa.
    for (const [id, marker] of markers.current) {
      if (!seen.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }
  }, [vehicles, meId]);

  // --- enquadrar todo mundo na primeira carga ------------------------------

  useEffect(() => {
    const m = map.current;
    if (!m || fitted.current || camera !== "overview") return;

    const pts = vehicles.map((v) => v.source?.fix).filter(Boolean) as LatLng[];
    if (pts.length === 0) return;

    fitted.current = true;
    const bounds = new maplibregl.LngLatBounds();
    for (const p of pts) bounds.extend([p.lng, p.lat]);
    bounds.extend([destination.lng, destination.lat]);

    // pitch/bearing vao JUNTO do fitBounds, e nao num easeTo separado: duas
    // animacoes seguidas se cancelam, e a inclinacao ficaria presa ao voltar
    // da visao em terceira pessoa.
    m.fitBounds(bounds, { padding: 64, maxZoom: 14, duration: 0, pitch: 0, bearing: 0 });
  }, [vehicles, destination, camera]);

  // --- camera ---------------------------------------------------------------

  useEffect(() => {
    const m = map.current;
    if (!m) return;

    if (camera === "overview") {
      // Reenquadrar e desinclinar acontecem no efeito do fitBounds, que roda
      // logo em seguida; fazer aqui tambem so criaria duas animacoes brigando.
      fitted.current = false;
      enteredFollow.current = false;
      return;
    }

    const target = vehicles.find((v) => v.id === (followId ?? meId)) ?? vehicles[0];
    const pos = target?.source?.fix;
    if (!pos) return;

    // A direcao vem da ROTA, nao do `heading` do GPS: parado no semaforo o
    // heading do aparelho oscila e a camera giraria sozinha.
    const bearing =
      route && target.distanceAlongM !== null && target.roadBound
        ? bearingAt(route, target.distanceAlongM)
        : (pos.heading ?? 0);

    // A entrada no modo seguir e animada uma vez; dali em diante a camera
    // acompanha instantaneamente, como num app de navegacao. Reanimar a cada
    // atualizacao de posicao faria uma animacao cancelar a outra e a camera
    // ficaria travada no lugar.
    const first = !enteredFollow.current;
    enteredFollow.current = true;

    m.easeTo({
      center: [pos.lng, pos.lat],
      zoom: 15.5,
      pitch: 58,
      bearing,
      duration: first ? 600 : 0,
    });
  }, [camera, followId, meId, vehicles, route]);

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
