-- KONVO — schema completo. Cole no SQL Editor do Supabase e rode.

-- ===== 0001_init.sql =====

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

-- ===== 0002_functions.sql =====

-- ===========================================================================
-- Konvo — funcoes de criacao e entrada
--
-- Criar e entrar numa viagem sao operacoes de dois passos (trip + membro).
-- Feitas do cliente, uma falha no meio deixaria uma viagem sem dono ou um
-- convidado sem lugar. Aqui viram uma transacao so.
-- ===========================================================================

-- --- codigo do convite -----------------------------------------------------

-- Alfabeto sem 0/O/1/I/L: o codigo vai ser lido em voz alta dentro do carro e
-- digitado por gente com pressa.
create or replace function public.generate_trip_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
  i integer;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from trips where code = candidate);
  end loop;
  return candidate;
end;
$$;

-- --- criar -----------------------------------------------------------------

create or replace function public.create_trip(
  p_name             text,
  p_mode             trip_mode,
  p_destination_name text,
  p_destination_lat  double precision,
  p_destination_lng  double precision,
  p_display_name     text,
  p_transport        transport_type default 'car',
  p_origin_lat       double precision default null,
  p_origin_lng       double precision default null,
  p_route_polyline   text default null,
  p_route_distance_m integer default null,
  p_route_duration_s integer default null,
  p_starts_at        timestamptz default null
)
returns trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip trips;
begin
  if auth.uid() is null then
    raise exception 'precisa estar autenticado';
  end if;

  insert into trips (
    code, name, mode, status,
    destination_name, destination_lat, destination_lng,
    origin_lat, origin_lng,
    route_polyline, route_distance_m, route_duration_s,
    created_by, starts_at
  ) values (
    generate_trip_code(), p_name, p_mode,
    case when p_starts_at is null then 'active' else 'upcoming' end,
    p_destination_name, p_destination_lat, p_destination_lng,
    p_origin_lat, p_origin_lng,
    p_route_polyline, p_route_distance_m, p_route_duration_s,
    auth.uid(), p_starts_at
  )
  returning * into v_trip;

  -- quem cria entra como guia
  insert into trip_members (trip_id, user_id, display_name, transport, color_index, is_leader)
  values (v_trip.id, auth.uid(), p_display_name, p_transport, 1, true);

  insert into trip_events (trip_id, type, payload)
  values (v_trip.id, 'member_joined', jsonb_build_object('name', p_display_name));

  return v_trip;
end;
$$;

-- --- previa do convite -----------------------------------------------------

-- Quem recebeu o link ainda NAO e membro, entao nao passa pelo RLS de `trips`.
-- Esta funcao mostra so o que a tela de convite precisa — nunca a posicao de
-- ninguem.
create or replace function public.get_trip_preview(p_code text)
returns table (
  trip_id          uuid,
  name             text,
  mode             trip_mode,
  status           trip_status,
  destination_name text,
  starts_at        timestamptz,
  member_count     bigint,
  host_name        text,
  already_member   boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    t.id,
    t.name,
    t.mode,
    t.status,
    t.destination_name,
    t.starts_at,
    (select count(*) from trip_members m where m.trip_id = t.id),
    (select m.display_name from trip_members m
      where m.trip_id = t.id and m.user_id = t.created_by limit 1),
    exists (select 1 from trip_members m where m.trip_id = t.id and m.user_id = auth.uid())
  from trips t
  where t.code = upper(p_code)
    and t.status in ('upcoming', 'active');
$$;

-- --- entrar ----------------------------------------------------------------

create or replace function public.join_trip(
  p_code         text,
  p_display_name text,
  p_transport    transport_type default 'car',
  p_avatar_url   text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
  v_color   smallint;
begin
  if auth.uid() is null then
    raise exception 'precisa estar autenticado';
  end if;

  select id into v_trip_id
  from trips
  where code = upper(p_code) and status in ('upcoming', 'active');

  if v_trip_id is null then
    raise exception 'convite inválido ou viagem encerrada';
  end if;

  -- reentrar depois de fechar o app nao pode criar um segundo participante
  if exists (select 1 from trip_members where trip_id = v_trip_id and user_id = auth.uid()) then
    update trip_members
       set display_name = p_display_name,
           transport = p_transport,
           avatar_url = coalesce(p_avatar_url, avatar_url)
     where trip_id = v_trip_id and user_id = auth.uid();
    return v_trip_id;
  end if;

  -- proxima cor livre da paleta de 6; depois disso, repete
  select (coalesce(max(color_index), 0) % 6) + 1 into v_color
  from trip_members where trip_id = v_trip_id;

  insert into trip_members (trip_id, user_id, display_name, transport, avatar_url, color_index)
  values (v_trip_id, auth.uid(), p_display_name, p_transport, p_avatar_url, v_color);

  insert into trip_events (trip_id, type, payload)
  values (v_trip_id, 'member_joined', jsonb_build_object('name', p_display_name));

  return v_trip_id;
end;
$$;

-- --- permissoes ------------------------------------------------------------

revoke all on function public.generate_trip_code() from public;
revoke all on function public.create_trip(text, trip_mode, text, double precision, double precision, text, transport_type, double precision, double precision, text, integer, integer, timestamptz) from public;
revoke all on function public.get_trip_preview(text) from public;
revoke all on function public.join_trip(text, text, transport_type, text) from public;

grant execute on function public.create_trip(text, trip_mode, text, double precision, double precision, text, transport_type, double precision, double precision, text, integer, integer, timestamptz) to authenticated;
grant execute on function public.get_trip_preview(text) to authenticated;
grant execute on function public.join_trip(text, text, transport_type, text) to authenticated;

-- ===== 0003_passengers_and_stops.sql =====

-- ===========================================================================
-- Konvo — passageiros, paradas planejadas e não-lidos da Activity
-- ===========================================================================

-- --- passageiros -----------------------------------------------------------

-- Quem viaja de carona aponta para o dono do veículo. Um campo resolve o que
-- o brief §12 mostra ("Ana · Passageira · com Pedro") e conserta a contagem de
-- veículos na Home: veículos = membros com transport <> 'passenger'.
--
-- Efeito colateral que interessa muito: a posição de um veículo passa a ser o
-- fix mais fresco entre seus ocupantes. Com isso o motorista pode estar com o
-- Konvo fechado (usando o Waze) que o carro continua no mapa, rastreado pelo
-- celular do passageiro — que é exatamente como a viagem vai ser rodada.
alter table trip_members
  add column riding_with uuid references trip_members (id) on delete set null;

create index trip_members_riding_with_idx on trip_members (riding_with);

-- Carona só faz sentido apontando para alguém da mesma viagem, e ninguém pega
-- carona consigo mesmo.
create or replace function public.check_riding_with()
returns trigger
language plpgsql
as $$
begin
  if new.riding_with is null then
    return new;
  end if;

  if new.riding_with = new.id then
    raise exception 'um membro não pode ser passageiro de si mesmo';
  end if;

  if not exists (
    select 1 from trip_members
    where id = new.riding_with and trip_id = new.trip_id
  ) then
    raise exception 'o motorista precisa ser da mesma viagem';
  end if;

  return new;
end;
$$;

create trigger trip_members_riding_with_check
  before insert or update of riding_with on trip_members
  for each row execute function public.check_riding_with();

-- --- não-lidos da Activity -------------------------------------------------

-- Sem tabela nova: não-lidos são os eventos da viagem posteriores a esta marca,
-- e o badge do sino soma isso entre as viagens da pessoa.
alter table trip_members
  add column activity_read_at timestamptz not null default now();

-- --- paradas planejadas ----------------------------------------------------

create type stop_kind as enum ('planned', 'reactive');

alter table trip_stops
  add column kind stop_kind not null default 'reactive',
  -- metros de rota até a parada: ordena a lista e posiciona o marcador na linha
  add column at_distance_m integer,
  add column note text;

create index trip_stops_order_idx on trip_stops (trip_id, at_distance_m);

-- --- entrar já escolhendo a carona -----------------------------------------

create or replace function public.join_trip(
  p_code         text,
  p_display_name text,
  p_transport    transport_type default 'car',
  p_avatar_url   text default null,
  p_riding_with  uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
  v_color   smallint;
  v_riding  uuid;
begin
  if auth.uid() is null then
    raise exception 'precisa estar autenticado';
  end if;

  select id into v_trip_id
  from trips
  where code = upper(p_code) and status in ('upcoming', 'active');

  if v_trip_id is null then
    raise exception 'convite inválido ou viagem encerrada';
  end if;

  -- carona só vale para quem se declarou passageiro
  v_riding := case when p_transport = 'passenger' then p_riding_with else null end;

  -- reentrar depois de fechar o app não pode criar um segundo participante
  if exists (select 1 from trip_members where trip_id = v_trip_id and user_id = auth.uid()) then
    update trip_members
       set display_name = p_display_name,
           transport = p_transport,
           avatar_url = coalesce(p_avatar_url, avatar_url),
           riding_with = v_riding
     where trip_id = v_trip_id and user_id = auth.uid();
    return v_trip_id;
  end if;

  select (coalesce(max(color_index), 0) % 6) + 1 into v_color
  from trip_members where trip_id = v_trip_id;

  insert into trip_members (
    trip_id, user_id, display_name, transport, avatar_url, color_index, riding_with
  )
  values (
    v_trip_id, auth.uid(), p_display_name, p_transport, p_avatar_url, v_color, v_riding
  );

  insert into trip_events (trip_id, type, payload)
  values (v_trip_id, 'member_joined', jsonb_build_object('name', p_display_name));

  return v_trip_id;
end;
$$;

-- a assinatura mudou; a versão de 4 argumentos não serve mais
drop function if exists public.join_trip(text, text, transport_type, text);

revoke all on function public.join_trip(text, text, transport_type, text, uuid) from public;
grant execute on function public.join_trip(text, text, transport_type, text, uuid) to authenticated;

-- ===== 0004_voice_notes.sql =====

-- ===========================================================================
-- Konvo — recados de voz (brief §16)
--
-- Em vez de WebRTC: grava, sobe para o Storage, avisa por realtime, toca
-- sozinho nos outros. E o padrao Zello/Voxer, que e literalmente o que o §16
-- descreve ("walkie-talkie leve, NAO interface de chamada") — e, ao contrario
-- de uma chamada, sobrevive a sinal ruim: o audio sobe quando der.
-- ===========================================================================

create table if not exists voice_notes (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references trips (id) on delete cascade,
  member_id    uuid references trip_members (id) on delete set null,
  storage_path text not null,
  duration_ms  integer,
  created_at   timestamptz not null default now()
);

create index if not exists voice_notes_trip_idx on voice_notes (trip_id, created_at desc);

alter table voice_notes enable row level security;

create policy "membros ouvem os recados"
  on voice_notes for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "membros mandam recado"
  on voice_notes for insert to authenticated
  with check (public.is_trip_member(trip_id));

do $$ begin
  alter publication supabase_realtime add table voice_notes;
exception when duplicate_object then null;
end $$;

-- --- armazenamento ---------------------------------------------------------

-- Bucket privado: o audio e conversa de familia dentro do carro, nao conteudo
-- publico. O app le por URL assinada de curta duracao.
insert into storage.buckets (id, name, public)
values ('voice-notes', 'voice-notes', false)
on conflict (id) do nothing;

-- O caminho do arquivo comeca com o id da viagem — `<trip_id>/<uuid>.webm` —
-- entao da para amarrar a permissao do arquivo a participacao na viagem.
create policy "membros leem o audio da propria viagem"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'voice-notes'
    and public.is_trip_member(((storage.foldername(name))[1])::uuid)
  );

create policy "membros sobem audio na propria viagem"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'voice-notes'
    and public.is_trip_member(((storage.foldername(name))[1])::uuid)
  );

-- ===== 0005_phone.sql =====

-- ===========================================================================
-- Konvo — telefone do participante
--
-- Existe como plano B: se o app falhar, ficar sem sinal ou a bateria acabar,
-- o grupo ainda precisa conseguir falar com a pessoa. Numa estrada isso deixa
-- de ser conveniencia.
--
-- Opcional de proposito — pedir telefone na entrada nao pode virar atrito.
-- ===========================================================================

alter table trip_members add column if not exists phone text;

-- ===== 0006_fix_create_trip_status.sql =====

-- ===========================================================================
-- Konvo — corrige o tipo do status em create_trip
--
-- O `case when ... then 'active' else 'upcoming' end` produz TEXT, e o Postgres
-- nao converte para enum sozinho num INSERT. Resultado:
--   column "status" is of type trip_status but expression is of type text
--
-- Criar viagem — a primeira coisa que qualquer pessoa faz no app — falhava
-- sempre. So apareceu ao chamar a funcao de verdade.
-- ===========================================================================

create or replace function public.create_trip(
  p_name             text,
  p_mode             trip_mode,
  p_destination_name text,
  p_destination_lat  double precision,
  p_destination_lng  double precision,
  p_display_name     text,
  p_transport        transport_type default 'car',
  p_origin_lat       double precision default null,
  p_origin_lng       double precision default null,
  p_route_polyline   text default null,
  p_route_distance_m integer default null,
  p_route_duration_s integer default null,
  p_starts_at        timestamptz default null
)
returns trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip trips;
begin
  if auth.uid() is null then
    raise exception 'precisa estar autenticado';
  end if;

  insert into trips (
    code, name, mode, status,
    destination_name, destination_lat, destination_lng,
    origin_lat, origin_lng,
    route_polyline, route_distance_m, route_duration_s,
    created_by, starts_at
  ) values (
    generate_trip_code(), p_name, p_mode,
    -- o cast explicito e o ponto desta migration
    (case when p_starts_at is null then 'active' else 'upcoming' end)::trip_status,
    p_destination_name, p_destination_lat, p_destination_lng,
    p_origin_lat, p_origin_lng,
    p_route_polyline, p_route_distance_m, p_route_duration_s,
    auth.uid(), p_starts_at
  )
  returning * into v_trip;

  -- quem cria entra como guia
  insert into trip_members (trip_id, user_id, display_name, transport, color_index, is_leader)
  values (v_trip.id, auth.uid(), p_display_name, p_transport, 1, true);

  insert into trip_events (trip_id, type, payload)
  values (v_trip.id, 'member_joined', jsonb_build_object('name', p_display_name));

  return v_trip;
end;
$$;

grant execute on function public.create_trip(
  text, trip_mode, text, double precision, double precision, text, transport_type,
  double precision, double precision, text, integer, integer, timestamptz
) to authenticated;

-- ===== 0007_rendezvous.sql =====

-- ===========================================================================
-- Konvo — ponto de encontro e horario de saida
--
-- O modelo ate aqui assumia que todo mundo ja sai junto. Na vida real quase
-- nunca e assim: as pessoas saem de lugares diferentes, em carros diferentes,
-- e SE ENCONTRAM antes de pegar a estrada.
--
-- Sem isto o app so servia depois que o grupo ja estava reunido — justamente
-- pulando o pedaco em que coordenar e mais dificil.
--
-- Com isto, o convite carrega o plano inteiro: onde encontrar, que horas, e
-- para onde vao depois. E da para jogar as duas pernas no Waze.
-- ===========================================================================

alter table trips
  add column if not exists meeting_name text,
  add column if not exists meeting_lat  double precision,
  add column if not exists meeting_lng  double precision,
  -- horario combinado do encontro; `starts_at` continua sendo a saida
  add column if not exists meet_at      timestamptz;

comment on column trips.meeting_name is
  'Onde o grupo se junta antes de partir. Nulo quando todos ja saem juntos.';

-- --- criar viagem com plano completo ---------------------------------------

create or replace function public.create_trip(
  p_name             text,
  p_mode             trip_mode,
  p_destination_name text,
  p_destination_lat  double precision,
  p_destination_lng  double precision,
  p_display_name     text,
  p_transport        transport_type default 'car',
  p_origin_lat       double precision default null,
  p_origin_lng       double precision default null,
  p_route_polyline   text default null,
  p_route_distance_m integer default null,
  p_route_duration_s integer default null,
  p_starts_at        timestamptz default null,
  p_meeting_name     text default null,
  p_meeting_lat      double precision default null,
  p_meeting_lng      double precision default null,
  p_meet_at          timestamptz default null
)
returns trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip trips;
begin
  if auth.uid() is null then
    raise exception 'precisa estar autenticado';
  end if;

  insert into trips (
    code, name, mode, status,
    destination_name, destination_lat, destination_lng,
    origin_lat, origin_lng,
    route_polyline, route_distance_m, route_duration_s,
    created_by, starts_at,
    meeting_name, meeting_lat, meeting_lng, meet_at
  ) values (
    generate_trip_code(), p_name, p_mode,
    -- Ha um plano marcado (encontro ou saida futura)? Entao a viagem nasce
    -- agendada, e nao correndo.
    (case when p_starts_at is null and p_meet_at is null then 'active' else 'upcoming' end)::trip_status,
    p_destination_name, p_destination_lat, p_destination_lng,
    p_origin_lat, p_origin_lng,
    p_route_polyline, p_route_distance_m, p_route_duration_s,
    auth.uid(), p_starts_at,
    p_meeting_name, p_meeting_lat, p_meeting_lng, p_meet_at
  )
  returning * into v_trip;

  insert into trip_members (trip_id, user_id, display_name, transport, color_index, is_leader)
  values (v_trip.id, auth.uid(), p_display_name, p_transport, 1, true);

  insert into trip_events (trip_id, type, payload)
  values (v_trip.id, 'member_joined', jsonb_build_object('name', p_display_name));

  return v_trip;
end;
$$;

grant execute on function public.create_trip(
  text, trip_mode, text, double precision, double precision, text, transport_type,
  double precision, double precision, text, integer, integer, timestamptz,
  text, double precision, double precision, timestamptz
) to authenticated;

-- --- a previa do convite mostra o plano ------------------------------------

drop function if exists public.get_trip_preview(text);

create or replace function public.get_trip_preview(p_code text)
returns table (
  trip_id          uuid,
  name             text,
  mode             trip_mode,
  status           trip_status,
  destination_name text,
  starts_at        timestamptz,
  meeting_name     text,
  meet_at          timestamptz,
  member_count     bigint,
  host_name        text,
  already_member   boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    t.id, t.name, t.mode, t.status, t.destination_name, t.starts_at,
    t.meeting_name, t.meet_at,
    (select count(*) from trip_members m where m.trip_id = t.id),
    (select m.display_name from trip_members m
      where m.trip_id = t.id and m.user_id = t.created_by limit 1),
    exists (select 1 from trip_members m where m.trip_id = t.id and m.user_id = auth.uid())
  from trips t
  where t.code = upper(p_code)
    and t.status in ('upcoming', 'active');
$$;

grant execute on function public.get_trip_preview(text) to authenticated;

-- ===== 0008_checkpoints_ghost.sql =====

-- ===========================================================================
-- Konvo — checkpoints e pausa de localizacao
-- ===========================================================================

-- --- checkpoints -----------------------------------------------------------

-- Pontos combinados NO MEIO do caminho, nao so no fim.
--
-- Numa viagem longa o grupo nao se reencontra no destino — se reencontra no
-- posto, no restaurante, na entrada da serra. O checkpoint transforma isso em
-- algo que o app entende: quando alguem entra no raio, o grupo ve "2 de 4
-- chegaram" sem ninguem precisar mandar mensagem.
create table if not exists trip_checkpoints (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references trips (id) on delete cascade,
  name          text not null,
  lat           double precision not null,
  lng           double precision not null,
  -- metros de rota ate aqui; ordena os checkpoints e posiciona no traçado
  at_distance_m integer,
  -- 200 m cobre um posto inteiro com estacionamento sem pegar quem so passou
  -- na pista ao lado
  radius_m      integer not null default 200,
  created_at    timestamptz not null default now()
);

create index if not exists trip_checkpoints_trip_idx
  on trip_checkpoints (trip_id, at_distance_m);

-- Quem ja passou por qual checkpoint. Uma linha por pessoa por ponto.
create table if not exists checkpoint_arrivals (
  checkpoint_id uuid not null references trip_checkpoints (id) on delete cascade,
  member_id     uuid not null references trip_members (id) on delete cascade,
  arrived_at    timestamptz not null default now(),
  primary key (checkpoint_id, member_id)
);

alter table trip_checkpoints enable row level security;
alter table checkpoint_arrivals enable row level security;

create policy "membros veem os checkpoints"
  on trip_checkpoints for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "membros criam checkpoints"
  on trip_checkpoints for all to authenticated
  using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id));

create policy "membros veem quem chegou"
  on checkpoint_arrivals for select to authenticated
  using (
    exists (
      select 1 from trip_checkpoints c
      where c.id = checkpoint_id and public.is_trip_member(c.trip_id)
    )
  );

-- Cada um registra a PROPRIA chegada. Marcar a chegada de outro seria
-- inventar um fato sobre onde a pessoa esteve.
create policy "cada um registra a propria chegada"
  on checkpoint_arrivals for insert to authenticated
  with check (
    exists (
      select 1 from trip_members m
      where m.id = member_id and m.user_id = auth.uid()
    )
  );

-- --- pausa de localizacao --------------------------------------------------

-- Deixar de compartilhar por um tempo, sem sair da viagem.
--
-- Existe por privacidade, nao por jogo: alguem desvia para resolver uma coisa
-- pessoal e nao quer o grupo inteiro acompanhando. Sem isso a unica saida
-- seria fechar o app — e aí o carro some do mapa sem explicacao, que e pior
-- para todo mundo.
--
-- Nao ha penalidade nem limite: a referencia que inspirou isso e um jogo,
-- onde esconder-se e vantagem. Aqui e uma viagem em familia.
alter table trip_members
  add column if not exists location_paused_until timestamptz;

comment on column trip_members.location_paused_until is
  'Enquanto no futuro, o app nao publica a posicao desta pessoa. O grupo ve "localizacao pausada", nunca uma posicao velha disfarcada de atual.';
