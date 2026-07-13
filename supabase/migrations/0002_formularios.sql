-- TatamePass — formulários de perfil como templates nomeados
-- Rodar no SQL Editor do Supabase depois da 0001_init.sql.

create table formularios (
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references academias (id) on delete cascade,
  nome text not null,
  padrao boolean not null default false,
  criado_em timestamptz not null default now()
);

-- Garante no banco que só existe 1 formulário padrão (ativo pros alunos) por academia.
create unique index formularios_um_padrao_por_academia
  on formularios (academia_id)
  where padrao;

create index formularios_academia_idx on formularios (academia_id);

-- ── Migra perfil_campos existentes pra dentro de um formulário ──────────

alter table perfil_campos add column formulario_id uuid;

insert into formularios (academia_id, nome, padrao)
select distinct academia_id, 'Formulário padrão', true
from perfil_campos
where academia_id not in (select academia_id from formularios);

update perfil_campos pc
set formulario_id = f.id
from formularios f
where f.academia_id = pc.academia_id and f.padrao = true and pc.formulario_id is null;

alter table perfil_campos alter column formulario_id set not null;
alter table perfil_campos
  add constraint perfil_campos_formulario_fk
  foreign key (formulario_id) references formularios (id) on delete cascade;

create index perfil_campos_formulario_idx on perfil_campos (formulario_id);

-- ── RLS ───────────────────────────────────────────────────────────────

alter table formularios enable row level security;

create policy "formularios_select_mesma_academia" on formularios
  for select using (academia_id = auth_academia_id());

create policy "formularios_write_professor" on formularios
  for all using (academia_id = auth_academia_id() and auth_role() = 'professor')
  with check (academia_id = auth_academia_id() and auth_role() = 'professor');

-- ── create_academia() passa a semear o formulário padrão com campos ─────
-- comuns de cadastro de aluno de academia de luta, incluindo dados de
-- responsável legal pra quando o aluno for menor de idade.

create or replace function create_academia(p_nome text, p_codigo text)
returns academias
language plpgsql security definer set search_path = public as $$
declare
  v_academia academias;
  v_formulario formularios;
begin
  insert into academias (nome, codigo_convite) values (p_nome, p_codigo)
  returning * into v_academia;

  insert into formularios (academia_id, nome, padrao)
  values (v_academia.id, 'Formulário padrão', true)
  returning * into v_formulario;

  insert into perfil_campos (academia_id, formulario_id, label, tipo, obrigatorio, ordem)
  values
    (v_academia.id, v_formulario.id, 'Data de nascimento', 'texto', true, 0),
    (v_academia.id, v_formulario.id, 'Telefone', 'texto', true, 1),
    (v_academia.id, v_formulario.id, 'Contato de emergência (nome e telefone)', 'texto', true, 2),
    (v_academia.id, v_formulario.id, 'Convênio médico ou plano de saúde', 'texto', false, 3),
    (v_academia.id, v_formulario.id, 'Alergias ou condições de saúde', 'texto', false, 4),
    (v_academia.id, v_formulario.id, 'Nome do responsável legal (se menor de idade)', 'texto', false, 5),
    (v_academia.id, v_formulario.id, 'Telefone do responsável legal (se menor de idade)', 'texto', false, 6),
    (v_academia.id, v_formulario.id, 'Atestado médico', 'documento', true, 7),
    (v_academia.id, v_formulario.id, 'Termo de responsabilidade', 'documento', true, 8);

  return v_academia;
end;
$$;
