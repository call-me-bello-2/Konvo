import type { LatLng } from "@/lib/konvo/types";

/**
 * Destinos sugeridos na Home.
 *
 * Lista fixa por enquanto. O plano e derivar dos destinos mais criados no
 * proprio app — mas com o banco recem-nascido isso seria uma lista vazia, e
 * uma lista vazia nao ajuda ninguem a comecar.
 *
 * As coordenadas sao reais: tocar num destes cria a viagem de verdade, com
 * rota calculada. Nao e enfeite.
 */

export interface PopularDestination extends LatLng {
  name: string;
  /** regiao, para desambiguar "Santos, SP" de "Santos, RJ" */
  context: string;
  /** gradiente da miniatura, nos tons da marca */
  tint: string;
}

export const POPULAR: PopularDestination[] = [
  {
    name: "Ubatuba",
    context: "São Paulo",
    lat: -23.4336,
    lng: -45.0712,
    tint: "linear-gradient(135deg,#19c6b3,#0043fd)",
  },
  {
    name: "Campos do Jordão",
    context: "São Paulo",
    lat: -22.7396,
    lng: -45.5911,
    tint: "linear-gradient(135deg,#7b61ff,#0043fd)",
  },
  {
    name: "Rio de Janeiro",
    context: "Rio de Janeiro",
    lat: -22.9068,
    lng: -43.1729,
    tint: "linear-gradient(135deg,#ff8a4c,#f0559e)",
  },
  {
    name: "Santos",
    context: "São Paulo",
    lat: -23.9608,
    lng: -46.3336,
    tint: "linear-gradient(135deg,#0043fd,#19c6b3)",
  },
  {
    name: "Ilhabela",
    context: "São Paulo",
    lat: -23.7781,
    lng: -45.3581,
    tint: "linear-gradient(135deg,#19c6b3,#7b61ff)",
  },
  {
    name: "Paraty",
    context: "Rio de Janeiro",
    lat: -23.2178,
    lng: -44.7131,
    tint: "linear-gradient(135deg,#f5b62e,#ff8a4c)",
  },
];
