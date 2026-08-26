/**
 * Modelo de dados do Konvo (brief §30).
 *
 * Espelha o schema do Supabase. Tudo que vem do banco entra por aqui, e a
 * logica de grupo trabalha so com estes tipos — nunca com linhas cruas.
 */

// ---------------------------------------------------------------------------
// Primitivos
// ---------------------------------------------------------------------------

export interface LatLng {
  lat: number;
  lng: number;
}

/** Leitura crua do GPS do dispositivo, antes de qualquer projecao. */
export interface Fix extends LatLng {
  /** metros; `coords.accuracy`. Acima de ~50m a posicao nao merece confianca. */
  accuracy: number;
  /** graus, 0 = norte. null quando parado ou indisponivel. */
  heading: number | null;
  /** m/s. null quando indisponivel. */
  speed: number | null;
  /** epoch ms do momento da leitura. */
  at: number;
}

export type TransportType = "car" | "motorcycle" | "bus" | "passenger" | "other";

export type TripMode = "together" | "meet";

export type TripStatus = "draft" | "upcoming" | "active" | "completed" | "cancelled";

/** brief §30 */
export type GroupStatusKind =
  | "together"
  | "stretching"
  | "split"
  | "stopped"
  | "regrouping"
  | "arriving"
  | "arrived";

/** brief §30 */
export type MemberState =
  | "on_route"
  | "ahead"
  | "behind"
  | "stopped"
  | "off_route"
  | "arrived"
  | "offline";

// ---------------------------------------------------------------------------
// Entidades
// ---------------------------------------------------------------------------

export interface Trip {
  id: string;
  /** codigo curto do convite, o que vai na URL: /join/K7F2QP */
  code: string;
  name: string;
  mode: TripMode;
  status: TripStatus;

  destination: LatLng & { name: string };
  origin: LatLng | null;

  /** polyline codificada (precisao 5) devolvida pela OSRM na criacao da trip. */
  routePolyline: string | null;
  routeDistanceM: number | null;
  routeDurationS: number | null;

  createdBy: string;
  startsAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
}

export interface TripMember {
  id: string;
  tripId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  /** indice 1..6 na paleta de participantes; atribuido na ordem de entrada. */
  colorIndex: number;
  transport: TransportType;
  isLeader: boolean;
  /**
   * Para quem viaja de carona: o id do membro dono do veiculo. null para quem
   * conduz. E o que amarra "Ana · Passageira · com Pedro" (brief §12) e o que
   * faz a contagem de veiculos da Home bater.
   */
  ridingWith: string | null;

  /** ultima posicao conhecida. null enquanto a pessoa nao compartilhou nada. */
  fix: Fix | null;

  /**
   * Derivados da projecao do fix sobre a rota da trip. Ficam no banco para
   * que quem entra no meio da viagem nao precise recalcular tudo.
   */
  distanceAlongM: number | null;
  offRouteM: number | null;

  arrivedAt: string | null;
  /** epoch ms do ultimo sinal de vida (posicao ou heartbeat). */
  lastSeenAt: number | null;
}

/** Membro depois de passar pela derivacao de estado. E o que a UI consome. */
export interface DerivedMember extends TripMember {
  state: MemberState;
  /** metros ate o destino pela rota. */
  remainingM: number | null;
  /** segundos estimados ate o destino. */
  etaS: number | null;
  /** segundos de atraso em relacao a frente do grupo. 0 para quem lidera. */
  behindByS: number;
  /** metros de atraso em relacao a frente do grupo. */
  behindByM: number;
  /** ha quanto tempo (ms) a posicao nao e atualizada. */
  staleForMs: number;
}

export interface GroupStatus {
  kind: GroupStatusKind;
  /**
   * Frase pronta em chave de traducao + valores. A UI nunca monta texto de
   * status na mao — brief §31: traduzir localizacao em linguagem humana.
   */
  headlineKey: string;
  headlineValues: Record<string, string | number>;
  /** ids dos membros que motivaram o status (quem ficou pra tras, etc). */
  subjectIds: string[];
  /** quando ha divisao: os dois grupos, da frente para tras. */
  clusters: string[][] | null;
  /** maior distancia temporal entre o primeiro e o ultimo, em segundos. */
  spreadS: number;
  spreadM: number;
}

/**
 * Um veiculo da viagem: quem conduz mais quem esta junto.
 *
 * O grupo se move em veiculos, nao em pessoas — dois passageiros do mesmo carro
 * nunca vao "se dividir". Por isso a geometria do grupo e a lista do mapa
 * trabalham sobre veiculos, e a lista de participantes sobre pessoas.
 */
export interface Vehicle {
  /** id do membro que conduz */
  id: string;
  /** nome do condutor — e como o veiculo e chamado nas frases de status */
  displayName: string;
  transport: TransportType;
  driver: DerivedMember;
  passengers: DerivedMember[];
  /** todos os ocupantes, condutor primeiro */
  occupants: DerivedMember[];
  /**
   * O ocupante cuja posicao representa o veiculo: o de leitura mais recente.
   * Faz o carro continuar no mapa quando o motorista fecha o Konvo para usar o
   * Waze e so o celular do passageiro segue transmitindo.
   */
  source: DerivedMember | null;
  distanceAlongM: number | null;
  state: MemberState;
  etaS: number | null;
  remainingM: number | null;
  behindByS: number;
  behindByM: number;
}

export type TripEventType =
  | "member_joined"
  | "member_left"
  | "trip_started"
  | "trip_completed"
  | "stop_proposed"
  | "stop_accepted"
  | "quick_action"
  | "group_split"
  | "group_rejoined"
  | "member_stopped"
  | "member_arrived"
  | "voice_note";

export interface TripEvent {
  id: string;
  tripId: string;
  memberId: string | null;
  type: TripEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export type QuickActionKind =
  | "gas"
  | "bathroom"
  | "food"
  | "stop"
  | "problem"
  | "regroup"
  | "ok";

export interface TripStop {
  id: string;
  tripId: string;
  name: string;
  lat: number;
  lng: number;
  proposedBy: string;
  status: "proposed" | "accepted" | "dismissed";
  createdAt: string;
}
