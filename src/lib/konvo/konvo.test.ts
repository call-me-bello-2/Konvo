/**
 * Testes do nucleo logico.
 *
 * Rodam sobre a rota REAL de São Paulo a Ubatuba (227 km, OSRM), nao sobre
 * geometria inventada — e o mesmo tipo de dado que vai chegar do banco na
 * viagem. Erro aqui e erro silencioso: o app continua bonito e mente sobre
 * onde as pessoas estao.
 */

import { describe, expect, it } from "vitest";

import fixture from "./__fixtures__/sp-ubatuba.json";
import {
  bearingAt,
  buildRoute,
  decodePolyline,
  haversineM,
  pointAtDistance,
  projectOnRoute,
} from "./route";
import { createDeriveContext, deriveMembers } from "./memberState";
import { detectTransition, deriveGroupStatus } from "./groupStatus";
import { formatAgo, formatDistance, formatDuration } from "./format";
import { countVehicles, deriveVehicles } from "./vehicles";
import { THRESHOLDS as T } from "./thresholds";
import type { Fix, TransportType, TripMember } from "./types";

const route = buildRoute(decodePolyline(fixture.polyline));
const DEST = fixture.destination;

// ---------------------------------------------------------------------------
// Ajudantes
// ---------------------------------------------------------------------------

const NOW = 1_750_000_000_000;

/** Cria um membro posicionado a N metros de rota do inicio. */
function memberAt(
  id: string,
  meters: number,
  opts: Partial<Fix> & {
    name?: string;
    lastSeenAt?: number;
    arrivedAt?: string;
    transport?: TransportType;
    ridingWith?: string;
  } = {},
): TripMember {
  const p = pointAtDistance(route, meters);
  return {
    id,
    tripId: "t1",
    userId: `u-${id}`,
    displayName: opts.name ?? id,
    avatarUrl: null,
    colorIndex: 1,
    transport: opts.transport ?? "car",
    isLeader: false,
    ridingWith: opts.ridingWith ?? null,
    fix: {
      lat: p.lat,
      lng: p.lng,
      accuracy: opts.accuracy ?? 8,
      heading: opts.heading ?? null,
      speed: opts.speed ?? 25,
      at: opts.at ?? NOW,
    },
    distanceAlongM: null,
    offRouteM: null,
    arrivedAt: opts.arrivedAt ?? null,
    // segue o horario do fix por padrao: quem mandou posicao esta vivo.
    // fixar em NOW faria o membro "sumir" sempre que o teste adianta o relogio.
    lastSeenAt: opts.lastSeenAt ?? opts.at ?? NOW,
  };
}

function derive(members: TripMember[], now = NOW) {
  const ctx = createDeriveContext(route, DEST, fixture.durationS);
  ctx.now = now;
  return { derived: deriveMembers(members, ctx), ctx };
}

// ---------------------------------------------------------------------------
// Rota
// ---------------------------------------------------------------------------

describe("route", () => {
  it("decodifica a polyline da OSRM com a distancia certa", () => {
    // tolerancia de 1%: haversine somada por segmento nao bate exatamente com
    // a distancia que a OSRM calcula, mas tem que ficar muito perto
    expect(route.totalM).toBeGreaterThan(fixture.distanceM * 0.99);
    expect(route.totalM).toBeLessThan(fixture.distanceM * 1.01);
  });

  it("comeca em São Paulo e termina em Ubatuba", () => {
    expect(haversineM(route.points[0], fixture.origin)).toBeLessThan(500);
    expect(haversineM(route.points[route.points.length - 1], DEST)).toBeLessThan(2000);
  });

  it("projeta um ponto da propria rota de volta na mesma marca", () => {
    for (const m of [0, 5_000, 60_000, 150_000, route.totalM - 1_000]) {
      const p = pointAtDistance(route, m);
      const proj = projectOnRoute(route, p);
      expect(proj.offRouteM).toBeLessThan(5);
      expect(Math.abs(proj.distanceAlongM - m)).toBeLessThan(50);
    }
  });

  it("mede o desvio de quem saiu da rota", () => {
    const p = pointAtDistance(route, 80_000);
    // ~1 km ao norte da rota
    const off = projectOnRoute(route, { lat: p.lat + 0.009, lng: p.lng });
    expect(off.offRouteM).toBeGreaterThan(800);
    expect(off.offRouteM).toBeLessThan(1200);
  });

  it("a direcao da rota aponta para o destino, nao para tras", () => {
    // SP -> Ubatuba corre para LESTE: o rumo tem que ficar no semicirculo
    // leste (0 a 180) na maior parte do caminho.
    const leste = [0.2, 0.4, 0.6, 0.8]
      .map((f) => bearingAt(route, route.totalM * f))
      .filter((b) => b > 0 && b < 180);
    expect(leste.length).toBeGreaterThanOrEqual(3);
  });

  it("a direcao muda pouco entre pontos proximos — camera nao pode tremer", () => {
    const a = bearingAt(route, 100_000);
    const b = bearingAt(route, 100_050);
    const diff = Math.abs(((a - b + 540) % 360) - 180);
    expect(diff).toBeLessThan(30);
  });

  it("o hint de indice nao muda o resultado", () => {
    const p = pointAtDistance(route, 120_000);
    const semHint = projectOnRoute(route, p);
    const comHint = projectOnRoute(route, p, semHint.index);
    expect(comHint.distanceAlongM).toBeCloseTo(semHint.distanceAlongM, 1);
  });

  it("hint errado nao envenena o resultado — cai para a busca completa", () => {
    const p = pointAtDistance(route, 200_000);
    const comHintRuim = projectOnRoute(route, p, 5);
    expect(Math.abs(comHintRuim.distanceAlongM - 200_000)).toBeLessThan(100);
  });
});

// ---------------------------------------------------------------------------
// Estado individual
// ---------------------------------------------------------------------------

describe("memberState", () => {
  it("ordena quem esta na frente e quanto o de tras esta atrasado", () => {
    const { derived } = derive([
      memberAt("lead", 100_000),
      memberAt("mid", 98_000),
      memberAt("tail", 95_000),
    ]);
    const by = Object.fromEntries(derived.map((d) => [d.id, d]));

    expect(by.lead.behindByM).toBe(0);
    expect(by.mid.behindByM).toBeCloseTo(2_000, -2);
    expect(by.tail.behindByM).toBeCloseTo(5_000, -2);
    expect(by.tail.behindByS).toBeGreaterThan(by.mid.behindByS);
  });

  it("descarta fix impreciso em vez de dividir o grupo por ruido de GPS", () => {
    const ruim = memberAt("ruim", 50_000, { accuracy: 250 });
    const { derived } = derive([memberAt("bom", 50_000), ruim]);
    // sem posicao utilizavel e sem posicao previa gravada -> offline, nao "atras"
    expect(derived.find((d) => d.id === "ruim")!.state).toBe("offline");
  });

  it("marca offline quem parou de transmitir", () => {
    const { derived } = derive([
      memberAt("ok", 50_000),
      memberAt("sumiu", 48_000, { lastSeenAt: NOW - 200_000 }),
    ]);
    expect(derived.find((d) => d.id === "sumiu")!.state).toBe("offline");
  });

  it("so marca parado depois da duracao minima, nao na primeira leitura lenta", () => {
    const ctx = createDeriveContext(route, DEST, fixture.durationS);

    ctx.now = NOW;
    let out = deriveMembers([memberAt("p", 50_000, { speed: 0.1 })], ctx);
    expect(out[0].state).not.toBe("stopped");

    // tres minutos depois, ainda no mesmo lugar — mas ainda transmitindo:
    // um carro parado continua publicando pelo heartbeat de 10s
    ctx.now = NOW + 180_000;
    out = deriveMembers([memberAt("p", 50_000, { speed: 0.1, at: ctx.now })], ctx);
    expect(out[0].state).toBe("stopped");
  });

  it("distingue parado (transmitindo) de offline (sem sinal)", () => {
    // A diferenca importa na estrada: 'parado' e informacao util — alguem
    // encostou. 'offline' e ausencia de informacao — pode estar andando numa
    // area sem cobertura. Tratar os dois igual seria mentir sobre um deles.
    const ctx = createDeriveContext(route, DEST, fixture.durationS);
    ctx.now = NOW;
    deriveMembers(
      [memberAt("parado", 50_000, { speed: 0.1 }), memberAt("semSinal", 50_000, { speed: 0.1 })],
      ctx,
    );

    ctx.now = NOW + 180_000;
    const out = deriveMembers(
      [
        // segue publicando, so nao anda
        memberAt("parado", 50_000, { speed: 0.1, at: ctx.now }),
        // ultima noticia ha 3 min
        memberAt("semSinal", 50_000, { speed: 0.1, at: NOW, lastSeenAt: NOW }),
      ],
      ctx,
    );

    const by = Object.fromEntries(out.map((d) => [d.id, d]));
    expect(by.parado.state).toBe("stopped");
    expect(by.semSinal.state).toBe("offline");
    expect(by.semSinal.staleForMs).toBeGreaterThan(T.member.offlineAfterMs);
  });

  it("voltar a andar limpa o estado de parado", () => {
    const ctx = createDeriveContext(route, DEST, fixture.durationS);
    ctx.now = NOW;
    deriveMembers([memberAt("p", 50_000, { speed: 0.1 })], ctx);
    ctx.now = NOW + 180_000;
    deriveMembers([memberAt("p", 50_100, { speed: 20, at: NOW + 180_000 })], ctx);
    expect(ctx.slowSince.has("p")).toBe(false);
  });

  it("detecta saida de rota", () => {
    const p = pointAtDistance(route, 70_000);
    const fora = memberAt("fora", 70_000);
    fora.fix = { ...fora.fix!, lat: p.lat + 0.02 }; // ~2,2 km fora
    const { derived } = derive([memberAt("dentro", 70_000), fora]);
    expect(derived.find((d) => d.id === "fora")!.state).toBe("off_route");
  });

  it("marca chegada por proximidade do destino", () => {
    const { derived } = derive([memberAt("chegou", route.totalM - 50)]);
    expect(derived[0].state).toBe("arrived");
  });

  it("ETA cai conforme a viagem avanca", () => {
    const { derived } = derive([memberAt("a", 10_000), memberAt("b", 200_000)]);
    const a = derived.find((d) => d.id === "a")!;
    const b = derived.find((d) => d.id === "b")!;
    expect(a.etaS!).toBeGreaterThan(b.etaS!);
    expect(a.remainingM!).toBeGreaterThan(b.remainingM!);
  });
});

// ---------------------------------------------------------------------------
// Estado do grupo — os cenarios do brief §13
// ---------------------------------------------------------------------------

describe("groupStatus", () => {
  const at = (...marks: number[]) =>
    derive(marks.map((m, i) => memberAt(`m${i}`, m, { name: `P${i}` }))).derived;

  it("todos proximos: junto", () => {
    const s = deriveGroupStatus({ members: at(100_000, 99_500, 99_000) });
    expect(s.kind).toBe("together");
    expect(s.headlineKey).toBe("status.together");
  });

  it("um ficando pra tras: esticando, e nomeia quem", () => {
    // ~5 km atras a 80 km/h = ~3,7 min -> passa de togetherS(2min), fica abaixo de splitGapS(6min)
    const members = at(100_000, 99_000, 94_500);
    const s = deriveGroupStatus({ members });
    expect(s.kind).toBe("stretching");
    expect(s.headlineValues.name).toBe("P2");
    expect(s.subjectIds).toEqual([members[2].id]);
  });

  it("lacuna grande: dividido, com os dois grupos separados", () => {
    // 3 na frente, 2 uns 15 km atras
    const members = at(100_000, 99_000, 98_500, 84_000, 83_000);
    const s = deriveGroupStatus({ members });
    expect(s.kind).toBe("split");
    expect(s.clusters).not.toBeNull();
    expect(s.clusters![0]).toHaveLength(3);
    expect(s.clusters![1]).toHaveLength(2);
    expect(s.headlineValues).toMatchObject({ front: 3, back: 2 });
  });

  it("divisao ganha de parada — coesao do grupo e mais urgente", () => {
    const ctx = createDeriveContext(route, DEST, fixture.durationS);
    ctx.now = NOW + 180_000;
    const members = deriveMembers(
      [
        memberAt("a", 100_000, { speed: 25, at: ctx.now }),
        memberAt("b", 99_000, { speed: 25, at: ctx.now }),
        memberAt("c", 80_000, { speed: 0.1, at: ctx.now }),
      ],
      ctx,
    );
    // c esta parado E longe; o titulo tem que ser a divisao
    expect(deriveGroupStatus({ members }).kind).toBe("split");
  });

  it("parado perto do grupo: aponta quem parou", () => {
    const ctx = createDeriveContext(route, DEST, fixture.durationS);
    ctx.now = NOW;
    deriveMembers(
      [memberAt("a", 100_000), memberAt("b", 99_800, { speed: 0.1, name: "Pedro" })],
      ctx,
    );
    ctx.now = NOW + 180_000;
    const members = deriveMembers(
      [
        memberAt("a", 100_200, { at: ctx.now }),
        memberAt("b", 99_800, { speed: 0.1, at: ctx.now, name: "Pedro" }),
      ],
      ctx,
    );
    const s = deriveGroupStatus({ members });
    expect(s.kind).toBe("stopped");
    expect(s.headlineValues.name).toBe("Pedro");
  });

  it("todos chegaram", () => {
    const s = deriveGroupStatus({
      members: at(route.totalM - 20, route.totalM - 40, route.totalM - 10),
    });
    expect(s.kind).toBe("arrived");
    expect(s.headlineKey).toBe("status.allArrived");
  });

  it("ninguem transmitindo: diz que perdeu o sinal, nao finge calma", () => {
    const membros = [
      memberAt("a", 50_000, { lastSeenAt: NOW - 300_000 }),
      memberAt("b", 50_000, { lastSeenAt: NOW - 300_000 }),
    ];
    const s = deriveGroupStatus({ members: derive(membros).derived });
    expect(s.headlineKey).toBe("status.noSignal");
    expect(s.headlineValues.count).toBe(2);
  });

  it("offline nao conta como divisao do grupo", () => {
    // quem esta sem sinal ha 5 min nao pode disparar "grupo dividido":
    // nao se sabe onde a pessoa esta, e alarmar seria mentira
    const membros = [
      memberAt("a", 100_000),
      memberAt("b", 99_500),
      memberAt("sumiu", 40_000, { lastSeenAt: NOW - 300_000 }),
    ];
    const s = deriveGroupStatus({ members: derive(membros).derived });
    expect(s.kind).toBe("together");
  });

  it("parada combinada vira regrouping", () => {
    const s = deriveGroupStatus({ members: at(100_000, 97_000), isRegrouping: true });
    expect(s.kind).toBe("regrouping");
  });

  it("grupo sozinho nunca se divide", () => {
    expect(deriveGroupStatus({ members: at(50_000) }).kind).toBe("together");
  });
});

// ---------------------------------------------------------------------------
// Transicoes
// ---------------------------------------------------------------------------

describe("detectTransition", () => {
  const st = (kind: string) => ({ kind }) as never;

  it("voltar de dividido para junto e um reencontro", () => {
    expect(detectTransition(st("split"), st("together"))).toBe("rejoined");
  });

  it("junto -> junto nao e transicao", () => {
    expect(detectTransition(st("together"), st("together"))).toBeNull();
  });

  it("junto -> esticando avisa", () => {
    expect(detectTransition(st("together"), st("stretching"))).toBe("stretched");
  });

  it("piorar de esticando para dividido avisa de divisao", () => {
    expect(detectTransition(st("stretching"), st("split"))).toBe("split");
  });

  it("melhorar de dividido para esticando nao dispara novo alarme", () => {
    expect(detectTransition(st("split"), st("stretching"))).toBeNull();
  });

  it("sem estado anterior nao inventa transicao", () => {
    expect(detectTransition(null, st("split"))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Formatacao
// ---------------------------------------------------------------------------

describe("format", () => {
  it("arredonda distancia curta para leitura de relance", () => {
    expect(formatDistance(412, "km", "pt-BR")).toBe("400 m");
    expect(formatDistance(2_840, "km", "pt-BR")).toBe("2,8 km");
    expect(formatDistance(142_300, "km", "pt-BR")).toBe("142 km");
  });

  it("usa virgula em pt e ponto em en", () => {
    expect(formatDistance(2_840, "km", "pt-BR")).toBe("2,8 km");
    expect(formatDistance(2_840, "km", "en")).toBe("2.8 km");
  });

  it("converte para milhas", () => {
    expect(formatDistance(1609.344, "mi", "en")).toBe("1.0 mi");
  });

  it("muda de escala conforme o tempo passa — minutos, horas, dias, data", () => {
    // Dentro da viagem importam minutos e horas. No log de atividade, que
    // atravessa semanas, "336h00 atrás" nao e informacao nenhuma.
    const MIN = 60_000;
    expect(formatAgo(10_000, "pt-BR")).toBe("agora");
    expect(formatAgo(18 * MIN, "pt-BR")).toBe("há 18 min");
    expect(formatAgo(182 * MIN, "pt-BR")).toBe("há 3h02");

    // `numeric: "auto"` entrega "ontem"/"anteontem" em vez de "há 2 dias" —
    // e melhor portugues, e o Intl faz isso por locale de graca
    expect(formatAgo(1 * 24 * 60 * MIN, "pt-BR")).toBe("ontem");
    expect(formatAgo(2 * 24 * 60 * MIN, "pt-BR")).toBe("anteontem");
    expect(formatAgo(1 * 24 * 60 * MIN, "en")).toBe("yesterday");

    // duas semanas vira data, nao contagem de horas
    const antigo = formatAgo(14 * 24 * 60 * MIN, "pt-BR");
    expect(antigo).not.toContain("há");
    expect(antigo).toMatch(/\d/);
  });

  it("formata duracao no padrao de viagem", () => {
    expect(formatDuration(180, "pt-BR")).toBe("3 min");
    expect(formatDuration(7_860, "pt-BR")).toBe("2h11");
    expect(formatDuration(3_840, "pt-BR")).toBe("1h04");
  });
});

// ---------------------------------------------------------------------------
// Sanidade dos limiares
// ---------------------------------------------------------------------------

describe("thresholds", () => {
  it("os limiares sao crescentes — senao um estado nunca acontece", () => {
    expect(T.group.togetherS).toBeLessThan(T.group.stretchingS);
    expect(T.member.offlineAfterMs).toBeGreaterThan(T.publish.maxIntervalMs);
  });
});

// ---------------------------------------------------------------------------
// Veiculos
// ---------------------------------------------------------------------------

describe("deriveVehicles", () => {
  it("agrupa passageiros com quem conduz — o exemplo do brief §07", () => {
    // Gustavo, Gabriel e Pedro de carro, Lucas de moto, Ana de carona com Pedro
    const { derived } = derive([
      memberAt("gustavo", 85_400, { name: "Gustavo" }),
      memberAt("gabriel", 85_000, { name: "Gabriel" }),
      memberAt("lucas", 84_200, { name: "Lucas", transport: "motorcycle" }),
      memberAt("pedro", 83_600, { name: "Pedro" }),
      memberAt("ana", 83_600, { name: "Ana", transport: "passenger", ridingWith: "pedro" }),
    ]);

    const vehicles = deriveVehicles(derived);

    expect(vehicles).toHaveLength(4); // 5 pessoas, 4 veiculos
    expect(countVehicles(derived)).toBe(4);

    const pedro = vehicles.find((v) => v.id === "pedro")!;
    expect(pedro.passengers.map((p) => p.displayName)).toEqual(["Ana"]);
    expect(pedro.occupants).toHaveLength(2);
    expect(vehicles.find((v) => v.id === "ana")).toBeUndefined();
  });

  it("o carro segue rastreado pelo passageiro quando o motorista fecha o app", () => {
    // ESTE e o cenario da viagem: um celular dedicado por carro. O motorista
    // esta no Waze com o Konvo fechado; quem transmite e o passageiro do lado.
    // Sem isto o carro apareceria "sem sinal" com alguem transmitindo dentro.
    const { derived } = derive([
      memberAt("gustavo", 85_000, { name: "Gustavo" }),
      // Pedro dirige, mas o Konvo dele nao manda posicao ha 5 min
      memberAt("pedro", 84_000, { name: "Pedro", lastSeenAt: NOW - 300_000 }),
      // Ana vai do lado, com o celular na tomada e o app aberto
      memberAt("ana", 84_000, {
        name: "Ana",
        transport: "passenger",
        ridingWith: "pedro",
      }),
    ]);

    const carroDoPedro = deriveVehicles(derived).find((v) => v.id === "pedro")!;

    expect(carroDoPedro.driver.state).toBe("offline");
    expect(carroDoPedro.source!.displayName).toBe("Ana");
    expect(carroDoPedro.state).not.toBe("offline");
    expect(carroDoPedro.distanceAlongM).not.toBeNull();
  });

  it("o veiculo so fica sem sinal quando ninguem dentro transmite", () => {
    const { derived } = derive([
      memberAt("gustavo", 85_000, { name: "Gustavo" }),
      memberAt("pedro", 84_000, { name: "Pedro", lastSeenAt: NOW - 300_000 }),
      memberAt("ana", 84_000, {
        name: "Ana",
        transport: "passenger",
        ridingWith: "pedro",
        lastSeenAt: NOW - 300_000,
      }),
    ]);

    expect(deriveVehicles(derived).find((v) => v.id === "pedro")!.state).toBe("offline");
  });

  it("carona apontando para quem saiu da viagem vira veiculo proprio", () => {
    // Melhor um pino a mais no mapa do que uma pessoa que some dele.
    const { derived } = derive([
      memberAt("gustavo", 85_000, { name: "Gustavo" }),
      memberAt("orfa", 84_000, {
        name: "Órfã",
        transport: "passenger",
        ridingWith: "quem-saiu",
      }),
    ]);

    const vehicles = deriveVehicles(derived);
    expect(vehicles).toHaveLength(2);
    expect(vehicles.some((v) => v.id === "orfa")).toBe(true);
  });

  it("o status do grupo conta veiculos, nao pessoas", () => {
    // Dois passageiros no mesmo carro nao podem inflar a contagem de "juntos"
    // nem aparecer como duas unidades separadas na divisao do grupo.
    const { derived } = derive([
      memberAt("a", 100_000, { name: "A" }),
      memberAt("b", 99_500, { name: "B" }),
      memberAt("b2", 99_500, { name: "B2", transport: "passenger", ridingWith: "b" }),
      memberAt("b3", 99_500, { name: "B3", transport: "passenger", ridingWith: "b" }),
    ]);

    const status = deriveGroupStatus({ members: deriveVehicles(derived) });
    expect(status.kind).toBe("together");
    expect(status.subjectIds).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Transportes de caminho proprio (aviao, trem, barco)
// ---------------------------------------------------------------------------

describe("caminho próprio", () => {
  it("quem voa não divide o grupo", () => {
    // O aviao esta a 100 km da rota. Se entrasse na geometria do comboio, o
    // app anunciaria "grupo dividido" — absurdo: ninguem vai encostar para
    // esperar um aviao.
    const p = pointAtDistance(route, 90_000);
    const aviao = memberAt("aviao", 90_000, { name: "Tia", transport: "plane" });
    aviao.fix = { ...aviao.fix!, lat: p.lat + 0.9, speed: 230 };

    const { derived } = derive([
      memberAt("a", 100_000, { name: "A" }),
      memberAt("b", 99_500, { name: "B" }),
      aviao,
    ]);

    const status = deriveGroupStatus({ members: deriveVehicles(derived) });
    expect(status.kind).toBe("together");
  });

  it("quem voa nunca aparece como fora de rota", () => {
    const p = pointAtDistance(route, 90_000);
    const aviao = memberAt("aviao", 90_000, { transport: "plane" });
    aviao.fix = { ...aviao.fix!, lat: p.lat + 0.9, speed: 230 };

    const { derived } = derive([memberAt("a", 100_000), aviao]);
    const v = derived.find((d) => d.id === "aviao")!;

    expect(v.state).not.toBe("off_route");
    expect(v.offRouteM).toBeNull();
  });

  it("a distância de quem voa é em linha reta, não pela estrada", () => {
    // Perto do destino em linha reta, mas longe pela rota — o que importa
    // para quem voa e a linha reta.
    const aviao = memberAt("aviao", 20_000, { transport: "plane", speed: 230 });
    aviao.fix = { ...aviao.fix!, lat: DEST.lat + 0.4, lng: DEST.lng };

    const { derived } = derive([aviao]);
    const v = derived[0];

    // ~44 km em linha reta, contra ~207 km que faltariam pela estrada
    expect(v.remainingM!).toBeLessThan(60_000);
  });

  it("todos chegaram inclui quem veio de avião", () => {
    const { derived } = derive([
      memberAt("a", route.totalM - 20),
      memberAt("aviao", route.totalM - 20, { transport: "plane" }),
    ]);
    expect(deriveGroupStatus({ members: deriveVehicles(derived) }).kind).toBe("arrived");
  });

  it("passageiro continua seguindo a rota — só o veículo dele muda", () => {
    const { derived } = derive([
      memberAt("motorista", 100_000, { name: "Pedro" }),
      memberAt("carona", 100_000, {
        name: "Ana",
        transport: "passenger",
        ridingWith: "motorista",
      }),
    ]);
    const carro = deriveVehicles(derived).find((v) => v.id === "motorista")!;
    expect(carro.roadBound).toBe(true);
    expect(carro.occupants).toHaveLength(2);
  });
});
