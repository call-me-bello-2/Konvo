import { participantColor } from "./ParticipantAvatar";
import type { TransportType, Vehicle } from "@/lib/konvo/types";

/**
 * O marcador de um veiculo no mapa.
 *
 * Mostra o VEICULO, nao o nome. Nome exige ler; a silhueta de um carro se
 * reconhece de relance, que e o unico modo de olhar disponivel para quem esta
 * dirigindo (§32). Quando ha mais de um ocupante, um numero no canto diz
 * quantos — em vez de empilhar avatares e nomes que ninguem vai decifrar.
 *
 * A cor continua sendo a da pessoa: e ela que amarra o pino ao nome na lista
 * de baixo e ao evento na Atividade.
 *
 * HTML e nao simbolo de GL porque assim o marcador usa os mesmos tokens do
 * resto da interface e acompanha o tema sem duplicar paleta.
 */

/** Silhuetas simples, desenhadas para ler bem a 22 px. */
const GLYPH: Record<TransportType, string> = {
  car: `<path d="M5 11l1.5-4A2 2 0 0 1 8.4 5.7h7.2a2 2 0 0 1 1.9 1.3L19 11m-14 0h14m-14 0v5m14-5v5M4 11h16a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Zm2.5 5v1.5m11-1.5v1.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
  motorcycle: `<circle cx="5.5" cy="16" r="3.2" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="18.5" cy="16" r="3.2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M5.5 16l3.2-5h5l2.5 5M12 11l-1.5-3H8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
  bus: `<rect x="4" y="4" width="16" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M4 10h16M8 17v2m8-2v2M8.5 13.5h0m7 0h0" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`,
  passenger: `<circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M5.5 19a6.5 6.5 0 0 1 13 0" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`,
  van: `<rect x="3" y="6" width="18" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M14 6v9M7 15v2m10-2v2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`,
  bicycle: `<circle cx="5.5" cy="16.5" r="3.3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18.5" cy="16.5" r="3.3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5.5 16.5l4-8h4l3 8m-7-8h-2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  walking: `<circle cx="12.5" cy="4.6" r="2.1" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12.5 8v5m0 0l-3 6m3-6l3 6M9 10.5l3.5-1.5 3.5 1.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
  train: `<rect x="5" y="3.5" width="14" height="12" rx="3" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M5 10h14M8.5 19l-2 2m9-2l2 2M9 13h0m6 0h0" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`,
  plane: `<path d="M10.2 20.5l1.6-5.4 3.4-1.6 5.3 1.4a1.1 1.1 0 0 0 1.1-1.7L18 8.6l1.2-4.1a1.2 1.2 0 0 0-1.8-1.3l-3.6 2.5-4.4-1.4a1.1 1.1 0 0 0-1.2 1.7l2.3 3.6-3.4 1.9-3.3-1a1 1 0 0 0-1 1.6l2.3 2.5-.6 2.6a.9.9 0 0 0 1.3 1l2.5-1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>`,
  boat: `<path d="M4 15.5h16l-2.2 4a1.5 1.5 0 0 1-1.3.8H7.5a1.5 1.5 0 0 1-1.3-.8zM12 15.5V4m0 0l5 7H7z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
  other: `<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.9"/>`,
};

export function buildVehicleMarker(v: Vehicle): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = "position:relative;line-height:0";
  updateVehicleMarker(el, v);
  return el;
}

export function updateVehicleMarker(el: HTMLElement, v: Vehicle, isMe = false) {
  const color = participantColor(v.driver.colorIndex);
  const glyph = GLYPH[v.transport] ?? GLYPH.other;
  const count = v.occupants.length;

  // Quem esta sem sinal aparece esmaecido: a interface nao pode dar a mesma
  // presenca a uma posicao de cinco minutos atras e a uma de agora.
  el.style.opacity = v.state === "offline" ? "0.4" : "1";

  const ring = isMe ? "0 0 0 3px var(--color-surface), 0 0 0 5px currentColor" : "0 0 0 3px var(--color-surface)";

  el.innerHTML = `
    <div style="
      position:relative;
      width:38px;height:38px;border-radius:13px;
      display:grid;place-items:center;
      background:${color};color:#fff;
      box-shadow:${ring}, 0 2px 6px rgb(0 0 0 / .35);
    ">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">${glyph}</svg>
      ${
        count > 1
          ? `<span style="
              position:absolute;top:-5px;right:-5px;
              min-width:18px;height:18px;padding:0 4px;
              border-radius:9px;
              display:grid;place-items:center;
              background:var(--color-surface);color:var(--color-ink);
              font:700 11px/1 var(--font-sans);
              box-shadow:0 1px 3px rgb(0 0 0 / .3);
            ">${count}</span>`
          : ""
      }
    </div>`;
}
