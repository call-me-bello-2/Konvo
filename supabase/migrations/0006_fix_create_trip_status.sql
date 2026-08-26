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
