/**
 * Busca de destino — Nominatim (OpenStreetMap).
 *
 * Sem API key e sem billing. Em troca, a politica de uso exige identificacao e
 * no maximo 1 requisicao por segundo: por isso o debounce e o cache abaixo nao
 * sao otimizacao, sao requisito.
 */

import type { LatLng } from "@/lib/konvo/types";

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const APP = import.meta.env.VITE_NOMINATIM_APP ?? "Konvo/0.1";

export interface Place extends LatLng {
  /** nome curto: "Ubatuba" */
  name: string;
  /** linha de apoio: "São Paulo, Região Sudeste, Brasil" */
  context: string;
}

const cache = new Map<string, Place[]>();

export async function searchPlaces(
  query: string,
  opts: { signal?: AbortSignal; countryCodes?: string } = {},
): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const key = `${q}|${opts.countryCodes ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const params = new URLSearchParams({
    q,
    format: "jsonv2",
    limit: "6",
    addressdetails: "1",
  });
  if (opts.countryCodes) params.set("countrycodes", opts.countryCodes);

  // O navegador nao deixa definir User-Agent, entao o parametro `email` e a
  // forma suportada de cumprir a exigencia de identificacao do Nominatim.
  const contact = APP.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0];
  if (contact) params.set("email", contact);

  const res = await fetch(`${ENDPOINT}?${params}`, {
    signal: opts.signal,
    headers: { Accept: "application/json", "Accept-Language": navigator.language },
  });

  if (!res.ok) throw new Error(`Nominatim respondeu ${res.status}`);

  const raw: NominatimResult[] = await res.json();
  const places = raw.map(toPlace);

  cache.set(key, places);
  return places;
}

interface NominatimResult {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
}

function toPlace(r: NominatimResult): Place {
  const parts = r.display_name.split(",").map((s) => s.trim());
  return {
    lat: Number(r.lat),
    lng: Number(r.lon),
    name: r.name || parts[0],
    // Tira o primeiro pedaco (que virou o nome) e o pais no fim fica; o meio e
    // o que desambigua "Santos, SP" de "Santos, RJ".
    context: parts.slice(1).join(", "),
  };
}
