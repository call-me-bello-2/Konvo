# Konvo

**Travel together.** Coordenação de grupos que viajam em veículos diferentes.

Responde a uma pergunta só: *onde está todo mundo, ainda estamos juntos, e quando todos chegam?*
Não é app de navegação — o motorista continua no Waze ou no Google Maps.

Alvo real: viagem de família em 3 carros, **23 a 25 de setembro de 2026**.

---

## Rodar

```bash
bun install && bun run dev
```

`http://localhost:3200`

| Comando | O que faz |
|---|---|
| `bun run dev` | dev server na 3200 (com `--host`, pra abrir do celular na mesma rede) |
| `bun run test` | testes do núcleo lógico |
| `bun run typecheck` | `tsc -b --noEmit` |
| `bun run brand` | regenera os assets de marca a partir da arte original |

> A máquina não tem Node instalado — tudo roda sob Bun.

## Configurar o Supabase

1. Criar um projeto novo em [supabase.com](https://supabase.com).
2. **Auth → Providers → habilitar "Anonymous sign-ins".** Sem isso ninguém entra por convite.
3. Aplicar as migrations, em ordem, pelo SQL Editor:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_functions.sql`
4. Copiar `.env.example` para `.env` e preencher `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
   (Settings → API).

## Deploy

Vercel, preset Vite. **HTTPS não é opcional**: `navigator.geolocation` só funciona em origem
segura — fora de `localhost`, em `http` puro o app não recebe posição nenhuma.

---

## Como está organizado

```
src/
  lib/konvo/      núcleo lógico — TS puro, sem React, testado
    route.ts        polyline, distâncias, projeção do GPS sobre a rota
    memberState.ts  estado de cada pessoa (atrás / parado / fora de rota / offline)
    groupStatus.ts  o estado do grupo em uma frase
    thresholds.ts   todos os números que decidem o que o app diz
    format.ts       distância, duração e "há 3 min", por locale
  lib/geo/        camada de posição: watchPosition, wake lock, fila offline
  components/     UI compartilhada
  routes/         telas
  i18n/           pt-BR + en
supabase/migrations/
scripts/          build dos assets de marca
```

### O núcleo lógico

Projetar cada posição GPS sobre a polyline da rota reduz o problema a **uma dimensão** —
"quantos metros de rota já andou". Quem está na frente, quem ficou pra trás e onde o grupo
se partiu viram comparação de números, sem heurística geográfica frágil.

Os testes rodam sobre a rota **real** São Paulo → Ubatuba (227 km, da OSRM), não sobre
geometria inventada.

---

## Duas divergências deliberadas do brief

**1. Estado do grupo em tempo, não em quilômetros.**
O brief §13 media dispersão em km. 2 km na Marginal é longe; 2 km na Rio-Santos a 100 km/h
é um minuto. Limiar fixo em metro alarma à toa na estrada e fica mudo na cidade. A distância
continua aparecendo, como informação secundária.

**2. Push-to-talk como nota de voz, não WebRTC.**
Grava → Storage → broadcast → toca sozinho nos outros. É o padrão Zello/Voxer, que é
literalmente o que o §16 pede ("walkie-talkie leve, **não** interface de chamada"), e
sobrevive a sinal ruim — WebRTC full-mesh não.

---

## A restrição que define o produto

**Navegador não rastreia GPS em segundo plano.** `watchPosition` para quando a aba perde o
foco; no iOS Safari, em segundos. Não tem contorno em web app.

Por isso, na viagem: **um celular dedicado por carro**, em primeiro plano, na tomada, com
Wake Lock ativa. O motorista navega em outro aparelho.

E por isso o app assume como requisito, não como enfeite:

- **Buffer offline** — a descida da serra tem zona morta. Posições vão pra IndexedDB e
  drenam na reconexão.
- **Estado offline honesto** — "Lucas · sem sinal há 4 min" com a última posição conhecida.
  Nunca um pin parado fingindo ser posição atual.
- **Throttle de escrita** — publica se andou >50 m ou passaram >10 s, não a cada fix.
  GPS de alta precisão com tela ligada consome ~15–20%/h.

---

## Serviços externos

Nenhum exige API key. Todos verificados com CORS `*`.

| Serviço | Uso |
|---|---|
| [OpenFreeMap](https://openfreemap.org/) | tiles vetoriais do mapa |
| [Nominatim](https://nominatim.openstreetmap.org/) | busca de destino (1 req/s, exige User-Agent próprio) |
| [OSRM](https://router.project-osrm.org/) | rota — **1× na criação da viagem**, gravada em `trips.route_polyline` |

A OSRM pública é servidor de demonstração, sem SLA. A rota nunca é consultada em runtime:
se cair no momento da criação, o app usa linha reta como fallback e segue funcionando.

---

## Marca

Azul primário: **`#0043FD`** — amostrado da arte aprovada. O `#536DFE` que o brief §03
chamava de "primary" é um azul visivelmente diferente e ficou como tom de apoio
(`konvo-400`); usar os dois como primário faria o wordmark brigar com os botões na mesma tela.

Os arquivos em `public/brand/` são gerados por `scripts/build-brand-assets.py`, que extrai
as formas exatas da arte original — a PNG entregue tinha uma caixa branca chapada atrás das
letras dentro do canvas transparente. Nenhuma forma foi redesenhada.
