/**
 * Dados de demonstracao (brief §26).
 *
 * Temporario: existe para desenhar e revisar as telas enquanto o Supabase nao
 * esta ligado. Segue exatamente os tipos reais, entao trocar por consulta ao
 * banco e trocar a origem — nao reescrever componente.
 */

import fixture from "@/lib/konvo/__fixtures__/sp-ubatuba.json";
import type { TransportType, TripMember } from "@/lib/konvo/types";

export const demoUser = { name: "Gustavo", colorIndex: 1, avatarUrl: null };

export const demoRoute = fixture;

interface DemoPerson {
  id: string;
  name: string;
  colorIndex: number;
  transport: TransportType;
  isLeader?: boolean;
  /** nome de quem conduz o carro, para passageiros */
  ridingWith?: string;
  /** metros de rota ja percorridos */
  atM: number;
}

/** Cenario base: os 5 do brief, ainda juntos, ~85 km rodados. */
export const demoPeople: DemoPerson[] = [
  { id: "p-gustavo", name: "Gustavo", colorIndex: 1, transport: "car", isLeader: true, atM: 85_400 },
  { id: "p-gabriel", name: "Gabriel", colorIndex: 2, transport: "car", atM: 85_000 },
  { id: "p-lucas", name: "Lucas", colorIndex: 3, transport: "motorcycle", atM: 84_200 },
  { id: "p-pedro", name: "Pedro", colorIndex: 4, transport: "car", atM: 83_600 },
  {
    id: "p-ana",
    name: "Ana",
    colorIndex: 5,
    transport: "passenger",
    ridingWith: "p-pedro",
    atM: 83_600,
  },
];

export function demoMembers(now = Date.now()): TripMember[] {
  return demoPeople.map((p) => ({
    id: p.id,
    tripId: "trip-ubatuba",
    userId: `u-${p.id}`,
    displayName: p.name,
    avatarUrl: null,
    colorIndex: p.colorIndex,
    transport: p.transport,
    isLeader: p.isLeader ?? false,
    ridingWith: p.ridingWith ?? null,
    fix: null,
    distanceAlongM: p.atM,
    offRouteM: 0,
    arrivedAt: null,
    lastSeenAt: now,
  }));
}

export interface DemoTrip {
  id: string;
  name: string;
  mode: "together" | "meet";
  status: "active" | "upcoming" | "completed";
  peopleCount: number;
  vehicleCount?: number;
  whenLabel?: string;
  distanceLabel?: string;
}

export const demoTrips: DemoTrip[] = [
  {
    id: "trip-ubatuba",
    name: "Ubatuba",
    mode: "together",
    status: "active",
    peopleCount: 5,
    vehicleCount: 4,
  },
  {
    id: "trip-tomorrowland",
    name: "Tomorrowland",
    mode: "meet",
    status: "upcoming",
    peopleCount: 8,
    whenLabel: "Amanhã · 18:00",
  },
  {
    id: "trip-rio",
    name: "Rio de Janeiro",
    mode: "together",
    status: "upcoming",
    peopleCount: 4,
    whenLabel: "04 set · 06:00",
  },
  {
    id: "trip-campos",
    name: "Campos do Jordão",
    mode: "together",
    status: "completed",
    peopleCount: 6,
    distanceLabel: "183 km",
  },
  {
    id: "trip-santos",
    name: "Santos",
    mode: "together",
    status: "completed",
    peopleCount: 4,
    distanceLabel: "91 km",
  },
];

// ---------------------------------------------------------------------------
// Activity (brief §21) — log de eventos, nao feed social
// ---------------------------------------------------------------------------

export interface DemoEvent {
  id: string;
  type:
    | "member_joined"
    | "stop_proposed"
    | "stop_accepted"
    | "group_split"
    | "group_rejoined"
    | "member_stopped"
    | "trip_completed"
    | "quick_action";
  tripId: string;
  tripName: string;
  /** nome de quem causou; ausente em eventos do grupo */
  actor?: string;
  colorIndex?: number;
  /** minutos atras */
  agoMin: number;
  unread: boolean;
  /** eventos acionaveis ganham botao */
  action?: "view" | "addStop";
}

export const demoEvents: DemoEvent[] = [
  {
    id: "e1",
    type: "stop_proposed",
    tripId: "trip-ubatuba",
    tripName: "Ubatuba",
    actor: "Lucas",
    colorIndex: 3,
    agoMin: 18,
    unread: true,
    action: "addStop",
  },
  {
    id: "e2",
    type: "group_rejoined",
    tripId: "trip-ubatuba",
    tripName: "Ubatuba",
    actor: "Pedro",
    colorIndex: 4,
    agoMin: 34,
    unread: true,
  },
  {
    id: "e3",
    type: "group_split",
    tripId: "trip-ubatuba",
    tripName: "Ubatuba",
    agoMin: 47,
    unread: false,
    action: "view",
  },
  {
    id: "e4",
    type: "member_joined",
    tripId: "trip-ubatuba",
    tripName: "Ubatuba",
    actor: "Gabriel",
    colorIndex: 2,
    agoMin: 182,
    unread: false,
  },
  {
    id: "e5",
    type: "stop_accepted",
    tripId: "trip-tomorrowland",
    tripName: "Tomorrowland",
    agoMin: 1_440,
    unread: false,
  },
  {
    id: "e6",
    type: "trip_completed",
    tripId: "trip-campos",
    tripName: "Campos do Jordão",
    agoMin: 20_160,
    unread: false,
  },
];

export const demoProfile = {
  name: "Gustavo",
  colorIndex: 1,
  navigateWith: "waze" as "waze" | "gmaps",
  distanceUnit: "km" as "km" | "mi",
  shareOnlyDuringTrips: true,
  emergencyContact: null as string | null,
};
