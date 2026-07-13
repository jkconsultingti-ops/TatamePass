-- TatamePass — aluno cancela o próprio check-in (do dia), professor cancela
-- uma ocorrência específica de aula (turma + data) com motivo.
-- Rodar no SQL Editor do Supabase depois da 0005_turmas_multi_dia_janelas.sql.

create policy "checkins_delete_proprio" on checkins
  for delete to authenticated using (aluno_id = auth.uid() and data = current_date);

create table aulas_canceladas (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references turmas (id) on delete cascade,
  academia_id uuid not null references academias (id) on delete cascade,
  data date not null,
  motivo text not null,
  cancelado_por uuid not null references profiles (id),
  criado_em timestamptz not null default now(),
  unique (turma_id, data)
);

create index aulas_canceladas_academia_idx on aulas_canceladas (academia_id);
create index aulas_canceladas_turma_idx on aulas_canceladas (turma_id, data);

alter table aulas_canceladas enable row level security;

create policy "aulas_canceladas_select_mesma_academia" on aulas_canceladas
  for select using (academia_id = auth_academia_id());

create policy "aulas_canceladas_write_professor" on aulas_canceladas
  for all using (academia_id = auth_academia_id() and auth_role() = 'professor')
  with check (academia_id = auth_academia_id() and auth_role() = 'professor');
