/**
 * Formatacao de numeros para leitura em movimento.
 *
 * Regras: pouca precisao (ninguem dirigindo precisa de 2,84 km), unidade sempre
 * junto do numero, e nada que mude de largura a cada atualizacao.
 */

export type DistanceUnit = "km" | "mi";

const M_PER_MI = 1609.344;

/** "400 m" · "2,8 km" · "142 km" */
export function formatDistance(meters: number, unit: DistanceUnit, locale: string): string {
  if (!Number.isFinite(meters)) return "—";

  if (unit === "mi") {
    const mi = meters / M_PER_MI;
    if (mi < 0.1) return `${Math.round(meters / 0.9144)} yd`;
    return `${fmt(mi, mi < 10 ? 1 : 0, locale)} mi`;
  }

  if (meters < 950) return `${Math.round(meters / 50) * 50} m`;
  const km = meters / 1000;
  return `${fmt(km, km < 10 ? 1 : 0, locale)} km`;
}

/**
 * "3 min" · "1h04" · "2h11"
 * O formato Xh00 e o que aparece em ETA de viagem longa; minutos soltos abaixo
 * de uma hora.
 */
export function formatDuration(seconds: number, locale: string): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";

  const total = Math.round(seconds / 60);
  if (total < 1) return locale.startsWith("pt") ? "menos de 1 min" : "under 1 min";
  if (total < 60) return `${total} min`;

  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

/** Forma curta para chips e listas: "4 min" · "2h11" */
export function formatDurationShort(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60));
  if (total < 60) return `${total} min`;
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, "0")}`;
}

/** Horario de chegada previsto: "18:42" */
export function formatArrivalClock(etaSeconds: number, locale: string): string {
  const at = new Date(Date.now() + etaSeconds * 1000);
  return at.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

/**
 * "agora" · "há 18 min" · "há 3h02" · "há 2 dias" · "12 de ago"
 *
 * As escalas sao diferentes de proposito. Dentro da viagem o que importa sao
 * minutos e horas; no log de atividade, que atravessa semanas, "336h00 atrás"
 * nao e informacao — vira data.
 */
export function formatAgo(ms: number, locale: string): string {
  const pt = locale.startsWith("pt");
  if (ms < 45_000) return pt ? "agora" : "now";

  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;

  if (ms < DAY) {
    const s = Math.round(ms / 1000);
    return pt ? `há ${formatDurationShort(s)}` : `${formatDurationShort(s)} ago`;
  }

  if (ms < 7 * DAY) {
    const days = Math.round(ms / DAY);
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-days, "day");
  }

  return new Date(Date.now() - ms).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
  });
}

function fmt(value: number, digits: number, locale: string): string {
  return value.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
