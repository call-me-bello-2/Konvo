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
