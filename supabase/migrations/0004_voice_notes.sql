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
