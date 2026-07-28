-- TatamePass — graduação por faixas configuráveis por academia, com
-- sequências pré-definidas por tipo de turma (adulto vs. infantil), em vez
-- do campo `faixa` de texto livre. Rodar depois de 0006_cancelamentos.sql.

create type tipo_turma as enum ('adulto', 'infantil');

alter table turmas add column tipo_turma tipo_turma not null default 'adulto';

create table faixas_config (
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references academias (id) on delete cascade,
  nome text not null,
  ordem integer not null,
  tipo_turma tipo_turma not null,
  -- null = faixa não conta aulas para grau (caso da faixa preta, que não tem
  -- "próxima faixa" nesse sistema)
  aulas_por_grau integer check (aulas_por_grau is null or aulas_por_grau > 0),
  -- null = não existe próxima faixa (última da sequência)
  graus_por_faixa integer check (graus_por_faixa is null or graus_por_faixa > 0),
  criado_em timestamptz not null default now(),
  unique (academia_id, tipo_turma, ordem)
);

create index faixas_config_academia_idx on faixas_config (academia_id, tipo_turma, ordem);

alter table faixas_config enable row level security;

-- faixas_config: leitura por todos da academia; escrita (só os números) por
-- professor da mesma academia. Sem insert/delete via app — a sequência de
-- faixas é pré-definida pelo seed, o professor só ajusta aulas_por_grau /
-- graus_por_faixa de cada uma.
create policy "faixas_config_select_mesma_academia" on faixas_config
  for select using (academia_id = auth_academia_id());

create policy "faixas_config_update_professor" on faixas_config
  for update using (academia_id = auth_academia_id() and auth_role() = 'professor')
  with check (academia_id = auth_academia_id() and auth_role() = 'professor');

-- graduacoes passa a referenciar a faixa configurável em vez de texto livre.
-- Sem dados reais em produção até aqui — a troca é direta, sem etapa de
-- migração de dados.
alter table graduacoes add column faixa_id uuid references faixas_config (id);

-- Seed da sequência padrão (mesma do Jiu-Jitsu adulto/infantil) para as
-- academias que já existem.
insert into faixas_config (academia_id, nome, ordem, tipo_turma, aulas_por_grau, graus_por_faixa)
select a.id, v.nome, v.ordem, v.tipo_turma::tipo_turma, v.aulas_por_grau, v.graus_por_faixa
from academias a
cross join (
  values
    ('Branca', 1, 'adulto', 16, 4),
    ('Azul', 2, 'adulto', 20, 4),
    ('Roxa', 3, 'adulto', 24, 4),
    ('Marrom', 4, 'adulto', 30, 4),
    ('Preta', 5, 'adulto', null, null),
    ('Branca', 1, 'infantil', 12, 4),
    ('Cinza', 2, 'infantil', 12, 4),
    ('Amarela', 3, 'infantil', 12, 4),
    ('Laranja', 4, 'infantil', 12, 4),
    ('Verde', 5, 'infantil', null, null)
) as v(nome, ordem, tipo_turma, aulas_por_grau, graus_por_faixa);

alter table graduacoes drop column faixa;
alter table graduacoes alter column faixa_id set not null;

-- create_academia() passa a semear também a sequência de faixas da academia
-- nova. Mantém tudo que as migrations anteriores (0002/0003/0004) já semeavam.
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

  insert into perfil_campos (academia_id, formulario_id, label, tipo, obrigatorio, ordem, opcoes)
  values
    (v_academia.id, v_formulario.id, 'Data de nascimento', 'data', true, 0, null),
    (v_academia.id, v_formulario.id, 'CPF', 'texto_curto', true, 1, null),
    (v_academia.id, v_formulario.id, 'Telefone', 'texto_curto', true, 2, null),
    (v_academia.id, v_formulario.id, 'Endereço completo', 'texto_longo', true, 3, null),
    (v_academia.id, v_formulario.id, 'Contato de emergência (nome e telefone)', 'texto_curto', true, 4, null),
    (v_academia.id, v_formulario.id, 'Convênio médico ou plano de saúde', 'texto_curto', false, 5, null),
    (
      v_academia.id, v_formulario.id, 'Tipo sanguíneo', 'lista_suspensa', false, 6,
      array['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Não sei']
    ),
    (v_academia.id, v_formulario.id, 'Alergias ou condições de saúde', 'texto_longo', false, 7, null),
    (v_academia.id, v_formulario.id, 'Nome do responsável legal (se menor de idade)', 'texto_curto', false, 8, null),
    (v_academia.id, v_formulario.id, 'Telefone do responsável legal (se menor de idade)', 'texto_curto', false, 9, null),
    (v_academia.id, v_formulario.id, 'CPF do responsável legal (se menor de idade)', 'texto_curto', false, 10, null),
    (v_academia.id, v_formulario.id, 'Termo de responsabilidade', 'documento', true, 11, null);

  insert into faixas_config (academia_id, nome, ordem, tipo_turma, aulas_por_grau, graus_por_faixa)
  values
    (v_academia.id, 'Branca', 1, 'adulto', 16, 4),
    (v_academia.id, 'Azul', 2, 'adulto', 20, 4),
    (v_academia.id, 'Roxa', 3, 'adulto', 24, 4),
    (v_academia.id, 'Marrom', 4, 'adulto', 30, 4),
    (v_academia.id, 'Preta', 5, 'adulto', null, null),
    (v_academia.id, 'Branca', 1, 'infantil', 12, 4),
    (v_academia.id, 'Cinza', 2, 'infantil', 12, 4),
    (v_academia.id, 'Amarela', 3, 'infantil', 12, 4),
    (v_academia.id, 'Laranja', 4, 'infantil', 12, 4),
    (v_academia.id, 'Verde', 5, 'infantil', null, null);

  return v_academia;
end;
$$;
