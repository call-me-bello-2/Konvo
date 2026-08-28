import { useEffect, useMemo, useRef } from "react";
import maplibregl, { type Map as MLMap, type Marker } from "maplibre-gl";

import { participantColor } from "./ParticipantAvatar";
import {
  buildVehicleMarker,
  updateVehicleMarker,
  type MarkerLabels,
} from "./vehicleMarker";
import { useTheme } from "@/theme";
import type { LatLng, Vehicle } from "@/lib/konvo/types";
import { bearingAt, sliceRoute, type Route } from "@/lib/konvo/route";

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
/**
 * Executa `fn` assim que o estilo estiver pronto — agora, se ja estiver.
 *
 * `isStyleLoaded()` volta false enquanto os tiles carregam, e nesse caso
 * esperar apenas por `style.load` nao adianta: esse evento ja disparou e nao
 * dispara de novo. `idle` cobre o intervalo, e o `style.load` continua
 * ouvindo para o caso de o tema mudar depois.
 */
function whenStyleReady(m: MLMap, fn: () => void): () => void {
  if (m.isStyleLoaded()) {
    fn();
  } else {
    m.once("idle", fn);
  }
  m.on("style.load", fn);
  return () => {
    m.off("style.load", fn);
    m.off("idle", fn);
  };
}

/**
 * Resolve `var(--x)` para a cor real.
 *
 * O MapLibre desenha em WebGL e nao tem acesso ao CSS: passar uma variavel
 * custom faz ele descartar o valor silenciosamente e manter o anterior. Os
 * marcadores nao sofrem disso porque sao HTML — o que torna o problema
 * especialmente traicoeiro, ja que metade da tela fica com a cor certa.
 */
function cssColor(value: string): string {
  const name = value.match(/^var\((--[^),]+)\)$/)?.[1];
  if (!name) return value;
  const resolved = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return resolved || value;
}

export type CameraMode = "overview" | "follow";

interface Props {
  route: Route | null;
  vehicles: Vehicle[];
  destination: LatLng & { name: string };
  camera?: CameraMode;
  /** textos das pilulas de estado; vem traduzidos de fora */
  labels: MarkerLabels;
  /** participante em foco: marcador maior, camera segue e rota dele acende */
  selectedId?: string | null;
  onSelect?: (vehicleId: string) => void;
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
  labels,
  selectedId,
  onSelect,
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

    // `style.load` dispara tambem depois de cada setStyle, que zera fontes e
    // camadas. Sem reagir a ele, a rota some ao trocar claro/escuro.
    return whenStyleReady(m, draw);
  }, [routeGeoJSON, resolved]);

  // --- rota de quem esta em foco --------------------------------------------

  /**
   * A camada nasce UMA vez (e renasce quando o tema troca o estilo); o dado e
   * atualizado a parte, num efeito que roda a cada posicao nova.
   *
   * Estavam juntos antes, e isso escondia uma corrida: o efeito re-executa a
   * cada segundo, e a limpeza removia o listener de `idle` antes de ele
   * disparar. Resultado — a camada existia, mas nunca recebia dado nem cor.
   */
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    const create = () => {
      if (m.getSource("selected-route")) return;
      m.addSource("selected-route", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      m.addLayer({
        id: "selected-route-line",
        type: "line",
        source: "selected-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#000", "line-width": 7, "line-opacity": 0.95 },
      });
    };

    return whenStyleReady(m, create);
  }, [resolved]);

  /**
   * O trecho que a pessoa selecionada ja percorreu, aceso na cor dela.
   *
   * A rota compartilhada mostra por onde o grupo vai; esta mostra ate onde
   * ESTA pessoa chegou. E o que responde "quanto ele ja andou?" de relance,
   * sem ler numero nenhum.
   */
  useEffect(() => {
    const m = map.current;
    const source = m?.getSource("selected-route") as maplibregl.GeoJSONSource | undefined;
    if (!m || !source) return;

    const target = vehicles.find((v) => v.id === selectedId);
    const upto = target?.distanceAlongM ?? null;

    if (route && target && upto !== null && target.roadBound) {
      source.setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: sliceRoute(route, 0, upto).map((p) => [p.lng, p.lat]),
        },
      });
      if (m.getLayer("selected-route-line")) {
        m.setPaintProperty(
          "selected-route-line",
          "line-color",
          cssColor(participantColor(target.driver.colorIndex)),
        );
      }
    } else {
      // Sem selecao a camada continua existindo, so vazia — remover e recriar
      // a cada toque faria o mapa piscar.
      source.setData({ type: "FeatureCollection", features: [] });
    }
  }, [selectedId, vehicles, route]);

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
        const el = buildVehicleMarker(v, labels, {
          isMe: v.id === meId,
          selected: v.id === selectedId,
        });
        // Tocar num marcador seleciona a pessoa — o mesmo efeito de tocar no
        // avatar da lateral. Dois caminhos para a mesma acao, porque as vezes o
        // dedo ja esta no mapa.
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelect?.(v.id);
        });
        marker = new maplibregl.Marker({ element: el }).setLngLat([pos.lng, pos.lat]);
        marker.addTo(m);
        markers.current.set(v.id, marker);
      } else {
        marker.setLngLat([pos.lng, pos.lat]);
        updateVehicleMarker(marker.getElement(), v, labels, {
          isMe: v.id === meId,
          selected: v.id === selectedId,
        });
      }
    }

    // Quem saiu da viagem tem que sair do mapa.
    for (const [id, marker] of markers.current) {
      if (!seen.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }
  }, [vehicles, meId, labels, selectedId, onSelect]);

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

    const target =
      vehicles.find((v) => v.id === (selectedId ?? followId ?? meId)) ?? vehicles[0];
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
  }, [camera, followId, meId, selectedId, vehicles, route]);

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
