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
