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
  /** gradiente de fundo — aparece enquanto a foto carrega */
  tint: string;
  /** foto do lugar, em public/places */
  photo: string;
  /** exigido pelas licencas CC das fotos; ver public/places/credits.json */
  credit: string;
}

export const POPULAR: PopularDestination[] = [
  {
    name: "Ubatuba",
    context: "São Paulo",
    lat: -23.4336,
    lng: -45.0712,
    tint: "linear-gradient(135deg,#19c6b3,#0043fd)",
    photo: "/places/ubatuba.jpg",
    credit: "Joalpe · CC BY-SA 4.0",
  },
  {
    name: "Campos do Jordão",
    context: "São Paulo",
    lat: -22.7396,
    lng: -45.5911,
    tint: "linear-gradient(135deg,#7b61ff,#0043fd)",
    photo: "/places/campos-do-jordao.jpg",
    credit: "Silvio Chiozini · CC BY 3.0",
  },
  {
    name: "Rio de Janeiro",
    context: "Rio de Janeiro",
    lat: -22.9068,
    lng: -43.1729,
    tint: "linear-gradient(135deg,#ff8a4c,#f0559e)",
    photo: "/places/rio-de-janeiro.jpg",
    credit: "Rafael Rabello de Barros · CC BY-SA 3.0",
  },
  {
    name: "Santos",
    context: "São Paulo",
    lat: -23.9608,
    lng: -46.3336,
    tint: "linear-gradient(135deg,#0043fd,#19c6b3)",
    photo: "/places/santos.jpg",
    credit: "Ricardo Frantz · domínio público",
  },
  {
    name: "Ilhabela",
    context: "São Paulo",
    lat: -23.7781,
    lng: -45.3581,
    tint: "linear-gradient(135deg,#19c6b3,#7b61ff)",
    photo: "/places/ilhabela.jpg",
    credit: "Lucas Lima 91 · CC BY-SA 2.0",
  },
  {
    name: "Paraty",
    context: "Rio de Janeiro",
    lat: -23.2178,
    lng: -44.7131,
    tint: "linear-gradient(135deg,#f5b62e,#ff8a4c)",
    photo: "/places/paraty.jpg",
    credit: "Vani Ribeiro · CC BY-SA 3.0",
  },
];
