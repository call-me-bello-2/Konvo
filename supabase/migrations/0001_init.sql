-- ===========================================================================
-- Konvo — schema inicial
--
-- Desenhado para o uso real: convidado entra por link sem criar conta, e cada
-- pessoa so escreve a propria posicao. Nada aqui depende de dados de demo.
-- ===========================================================================

create extension if not exists pgcrypto;

-- --- tipos -----------------------------------------------------------------

create type trip_mode as enum ('together', 'meet');
create type trip_status as enum ('draft', 'upcoming', 'active', 'completed', 'cancelled');
create type transport_type as enum ('car', 'motorcycle', 'bus', 'passenger', 'other');
create type member_state as enum (
  'on_route', 'ahead', 'behind', 'stopped', 'off_route', 'arrived', 'offline'
);
create type stop_status as enum ('proposed', 'accepted', 'dismissed');

-- --- trips -----------------------------------------------------------------

create table trips (
  id                uuid primary key default gen_random_uuid(),
  -- codigo do convite: o que vai na URL /join/K7F2QP
  code              text not null unique,
  name              text not null,
  mode              trip_mode not null default 'together',
  status            trip_status not null default 'upcoming',

  destination_name  text not null,
  destination_lat   double precision not null,
  destination_lng   double precision not null,
  origin_lat        double precision,
  origin_lng        double precision,

  -- rota calculada UMA vez, na criacao. Em runtime nunca mais se consulta a
  -- OSRM: ela e servidor de demonstracao, sem SLA, e a viagem nao pode
  -- depender dela estar no ar no meio da serra.
  route_polyline    text,
  route_distance_m  integer,
  route_duration_s  integer,

  created_by        uuid not null references auth.users (id) on delete cascade,
  starts_at         timestamptz,
  started_at        timestamptz,
  ended_at          timestamptz,
  created_at        timestamptz not null default now()
);

create index trips_created_by_idx on trips (created_by);
create index trips_status_idx on trips (status);

-- --- membros ---------------------------------------------------------------

create table trip_members (
  id                uuid primary key default gen_random_uuid(),
  trip_id           uuid not null references trips (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,

  display_name      text not null,
  avatar_url        text,
  -- 1..6, na ordem de entrada; e a cor da pessoa em todo o produto
  color_index       smallint not null default 1,
  transport         transport_type not null default 'car',
  is_leader         boolean not null default false,

  -- posicao atual (o ao vivo vai por broadcast; isto e a copia duravel,
  -- para quem entra no meio da viagem)
  lat               double precision,
  lng               double precision,
  accuracy          real,
  heading           real,
  speed             real,
  fix_at            timestamptz,

  -- derivados da projecao sobre a rota
  distance_along_m  integer,
  off_route_m       integer,

  state             member_state not null default 'offline',
  arrived_at        timestamptz,
  last_seen_at      timestamptz,
  joined_at         timestamptz not null default now(),

  unique (trip_id, user_id)
);

create index trip_members_trip_idx on trip_members (trip_id);
create index trip_members_user_idx on trip_members (user_id);

-- --- eventos ---------------------------------------------------------------

create table trip_events (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips (id) on delete cascade,
  member_id   uuid references trip_members (id) on delete set null,
  type        text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index trip_events_trip_idx on trip_events (trip_id, created_at desc);

-- --- paradas compartilhadas ------------------------------------------------

create table trip_stops (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references trips (id) on delete cascade,
  name         text not null,
  lat          double precision not null,
  lng          double precision not null,
  proposed_by  uuid references trip_members (id) on delete set null,
  status       stop_status not null default 'proposed',
  created_at   timestamptz not null default now()
);

create index trip_stops_trip_idx on trip_stops (trip_id);

-- --- trilha para o recap ---------------------------------------------------

create table position_history (
  id           bigserial primary key,
  trip_id      uuid not null references trips (id) on delete cascade,
  member_id    uuid not null references trip_members (id) on delete cascade,
  lat          double precision not null,
  lng          double precision not null,
  recorded_at  timestamptz not null default now()
);

create index position_history_trip_idx on position_history (trip_id, recorded_at);

-- ===========================================================================
-- Seguranca
-- ===========================================================================

-- Helper com SECURITY DEFINER de proposito: se a policy de `trip_members`
-- consultasse `trip_members` diretamente, o RLS chamaria a si mesmo e o
-- Postgres derrubaria tudo com recursao infinita. O definer roda fora do RLS
-- e corta o ciclo.
create or replace function public.is_trip_member(p_trip uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from trip_members
    where trip_id = p_trip and user_id = auth.uid()
  );
$$;

revoke all on function public.is_trip_member(uuid) from public;
grant execute on function public.is_trip_member(uuid) to authenticated;

alter table trips enable row level security;
alter table trip_members enable row level security;
alter table trip_events enable row level security;
alter table trip_stops enable row level security;
alter table position_history enable row level security;

-- --- trips -----------------------------------------------------------------

create policy "membros leem a trip"
  on trips for select to authenticated
  using (public.is_trip_member(id));

create policy "qualquer autenticado cria trip"
  on trips for insert to authenticated
  with check (created_by = auth.uid());

create policy "so quem criou edita a trip"
  on trips for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "so quem criou apaga a trip"
  on trips for delete to authenticated
  using (created_by = auth.uid());

-- --- membros ---------------------------------------------------------------

create policy "membros veem uns aos outros"
  on trip_members for select to authenticated
  using (public.is_trip_member(trip_id));

-- Cada um escreve so a propria linha. Isto e o que impede alguem de forjar a
-- posicao dos outros no mapa.
create policy "cada um atualiza a propria posicao"
  on trip_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "cada um sai da propria trip"
  on trip_members for delete to authenticated
  using (user_id = auth.uid());

-- Sem policy de INSERT: entrar numa trip so acontece pela funcao join_trip,
-- que exige o codigo do convite.

-- --- eventos ---------------------------------------------------------------

create policy "membros leem os eventos"
  on trip_events for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "membros criam eventos"
  on trip_events for insert to authenticated
  with check (public.is_trip_member(trip_id));

-- --- paradas ---------------------------------------------------------------

create policy "membros leem as paradas"
  on trip_stops for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "membros propoem paradas"
  on trip_stops for insert to authenticated
  with check (public.is_trip_member(trip_id));

create policy "membros decidem sobre a parada"
  on trip_stops for update to authenticated
  using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id));

-- --- trilha ----------------------------------------------------------------

create policy "membros leem a trilha"
  on position_history for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "cada um grava a propria trilha"
  on position_history for insert to authenticated
  with check (
    public.is_trip_member(trip_id)
    and exists (
      select 1 from trip_members m
      where m.id = member_id and m.user_id = auth.uid()
    )
  );

-- ===========================================================================
-- Realtime
-- ===========================================================================

alter publication supabase_realtime add table trip_members;
alter publication supabase_realtime add table trip_events;
alter publication supabase_realtime add table trip_stops;

-- O UPDATE de posicao precisa mandar a linha inteira, senao o outro cliente
-- recebe so o id e nao tem o que desenhar.
alter table trip_members replica identity full;
alter table trip_stops replica identity full;
