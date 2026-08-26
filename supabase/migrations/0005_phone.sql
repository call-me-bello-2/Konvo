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
