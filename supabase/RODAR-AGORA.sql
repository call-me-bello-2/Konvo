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
