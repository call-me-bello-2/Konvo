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
