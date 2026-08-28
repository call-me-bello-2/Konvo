import { participantColor } from "./ParticipantAvatar";
import type { TransportType, Vehicle } from "@/lib/konvo/types";

/**
 * O marcador de um veiculo no mapa.
 *
 * Composicao, de cima para baixo:
 *   - pilula de estado ("junto", "+3 min", "parado")
 *   - foto da pessoa, com anel na cor do estado
 *   - selo do veiculo
 *
 * A referencia visual (apps de direcao em grupo) poe a VELOCIDADE na pilula.
 * Aqui vai a diferenca de tempo, porque a pergunta e outra: ninguem viajando
 * junto precisa saber que o amigo esta a 82 km/h — precisa saber que ele esta
 * tres minutos atras. Velocidade e curiosidade; distancia temporal e decisao.
 *
 * A cor faz o trabalho pesado: bate o olho e ve quem esta bem e quem nao esta,
 * sem ler. Mas a pilula sempre carrega texto junto — cor sozinha exclui quem
 * nao distingue verde de vermelho, e essa e a informacao mais importante da
 * tela.
 */

const GLYPH: Record<TransportType, string> = {
  car: "M5 11l1.5-4A2 2 0 0 1 8.4 5.7h7.2a2 2 0 0 1 1.9 1.3L19 11M4 11h16a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Zm2.5 5v1.5m11-1.5v1.5",
  motorcycle: "M5.5 16l3.2-5h5l2.5 5M12 11l-1.5-3H8M5.5 12.8a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4Zm13 0a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4Z",
  bus: "M4 4h16v13H4zM4 10h16M8 17v2m8-2v2",
  van: "M3 6h18v9H3zM14 6v9M7 15v2m10-2v2",
  passenger: "M12 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM5.5 19a6.5 6.5 0 0 1 13 0",
  bicycle: "M5.5 16.5l4-8h4l3 8m-7-8h-2M5.5 13.2a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 0 1 0-6.6Zm13 0a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 0 1 0-6.6Z",
  walking: "M12.5 8v5m0 0l-3 6m3-6l3 6M9 10.5l3.5-1.5 3.5 1.5M12.5 2.5a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2Z",
  train: "M5 4h14v11H5zM5 10h14M8.5 19l-2 2m9-2l2 2",
  plane: "M10.2 20.5l1.6-5.4 3.4-1.6 5.3 1.4 -3.5-6.3 1.2-4.1-3.6 2.5-4.4-1.4 2.3 3.6-3.4 1.9-3.3-1 2.3 2.5-.6 2.6z",
  boat: "M4 15.5h16l-2.2 4H6.2zM12 15.5V4l5 7H7z",
  other: "M12 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14z",
};

/** Cor do anel e da pilula. Verde = bem, ambar = atencao, vermelho = problema. */
function stateColor(v: Vehicle): string {
  switch (v.state) {
    case "arrived":
    case "on_route":
    case "ahead":
      return "var(--color-together)";
    case "behind":
      return v.behindByS > 360 ? "var(--color-split)" : "var(--color-stretching)";
    case "stopped":
    case "off_route":
      return "var(--color-stretching)";
    case "offline":
      return "var(--color-ink-35)";
    default:
      return "var(--color-together)";
  }
}

export interface MarkerLabels {
  together: string;
  stopped: string;
  offline: string;
  arrived: string;
  /** recebe os segundos de atraso e devolve algo como "+3 min" */
  behind: (seconds: number) => string;
}

function statusText(v: Vehicle, labels: MarkerLabels): string {
  if (v.state === "arrived") return labels.arrived;
  if (v.state === "offline") return labels.offline;
  if (v.state === "stopped") return labels.stopped;
  if (v.behindByS < 45) return labels.together;
  return labels.behind(v.behindByS);
}

export function buildVehicleMarker(
  v: Vehicle,
  labels: MarkerLabels,
  opts: { isMe?: boolean; selected?: boolean } = {},
): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = "position:relative;line-height:0;cursor:pointer";
  updateVehicleMarker(el, v, labels, opts);
  return el;
}

export function updateVehicleMarker(
  el: HTMLElement,
  v: Vehicle,
  labels: MarkerLabels,
  { isMe = false, selected = false }: { isMe?: boolean; selected?: boolean } = {},
) {
  const color = stateColor(v);
  const person = v.source ?? v.driver;
  const tint = participantColor(v.driver.colorIndex);
  const glyph = GLYPH[v.transport] ?? GLYPH.other;
  const count = v.occupants.length;

  // Quem esta sem sinal aparece esmaecido: a interface nao pode dar a mesma
  // presenca a uma posicao de cinco minutos atras e a uma de agora.
  el.style.opacity = v.state === "offline" ? "0.5" : "1";
  el.style.zIndex = selected ? "3" : isMe ? "2" : "1";

  const face = person.avatarUrl
    ? `<img src="${person.avatarUrl}" alt="" style="width:100%;height:100%;object-fit:cover"/>`
    : `<span style="font:800 15px/1 var(--font-sans);color:#fff">${(person.displayName.trim()[0] ?? "?").toUpperCase()}</span>`;

  const size = selected ? 52 : isMe ? 44 : 38;
  const showPill = selected || isMe;

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
      ${
        // A pilula so aparece em quem esta em foco. Com quatro carros a menos
        // de um quilometro, quatro pilulas viram uma mancha ilegivel — e o
        // estado de todo mundo ja esta na coluna lateral.
        showPill
          ? `<span style="
               padding:3px 8px;border-radius:999px;white-space:nowrap;
               background:${color};color:#04140f;
               font:800 11px/1 var(--font-sans);
               box-shadow:0 1px 4px rgb(0 0 0 / .35);
             ">${statusText(v, labels)}</span>`
          : ""
      }

      <!-- foto com anel na cor do estado -->
      <span style="position:relative;display:block">
        <span style="
          display:grid;place-items:center;overflow:hidden;
          width:${size}px;height:${size}px;border-radius:999px;
          background:${tint};
          box-shadow:0 0 0 3px ${color}, 0 0 0 ${selected ? 6 : 5}px var(--color-surface), 0 2px 8px rgb(0 0 0 / .4);
        ">${face}</span>

        <!-- selo do veiculo -->
        <span style="
          position:absolute;bottom:-3px;right:-5px;
          display:grid;place-items:center;
          width:${selected || isMe ? 22 : 19}px;height:${selected || isMe ? 22 : 19}px;border-radius:999px;
          background:var(--color-surface);color:var(--color-ink);
          box-shadow:0 1px 3px rgb(0 0 0 / .35);
        ">
          <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
            <path d="${glyph}" fill="none" stroke="currentColor" stroke-width="2.1"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>

        ${
          count > 1
            ? `<span style="
                 position:absolute;top:-3px;left:-6px;
                 min-width:19px;height:19px;padding:0 4px;
                 display:grid;place-items:center;border-radius:999px;
                 background:var(--color-ink);color:var(--color-canvas);
                 font:800 11px/1 var(--font-sans);
                 box-shadow:0 1px 3px rgb(0 0 0 / .35);
               ">${count}</span>`
            : ""
        }
      </span>
    </div>`;
}
