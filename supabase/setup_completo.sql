-- TatamePass — script único de bootstrap para um projeto Supabase novo.
--
-- Equivale a rodar 0001_init.sql até 0009_identificador_login.sql em
-- sequência, mas já no estado final (sem os passos intermediários que essas
-- migrations desfazem umas nas outras — ex: dia_semana → dias_semana,
-- campo_tipo enum → text+check, faixa texto livre → faixa_id). Use este
-- arquivo para um projeto Supabase vazio. Os arquivos numerados em
-- supabase/migrations/ continuam no repo como histórico de como o schema
-- evoluiu — não precisam ser rodados se você já rodou este aqui.
--
-- Rodar tudo de uma vez no SQL Editor do Supabase, em um projeto novo, sem
-- nada criado ainda.

create extension if not exists "pgcrypto";

-- ── Tipos ─────────────────────────────────────────────────────────────

create type user_role as enum ('aluno', 'professor');
create type tipo_turma as enum ('adulto', 'infantil');
create type exame_medico_status as enum ('pendente', 'aprovado');
create type identificador_tipo as enum ('email', 'telefone');

-- ── Tabelas ───────────────────────────────────────────────────────────

create table academias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo_convite text not null unique,
  criado_em timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  academia_id uuid not null references academias (id) on delete cascade,
  role user_role not null,
  nome text not null,
  foto_url text,
  turma_principal_id uuid,
  identificador_tipo identificador_tipo,
  identificador_valor text,
  criado_em timestamptz not null default now()
);

create table turmas (
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references academias (id) on delete cascade,
  nome text not null,
  professor_id uuid not null references profiles (id),
  tipo_turma tipo_turma not null default 'adulto',
  dias_semana smallint[] not null,
  horario_inicio time not null,
  horario_fim time not null,
  janela_checkin_antes_horas numeric(4, 2) not null default 0 check (janela_checkin_antes_horas >= 0),
  janela_checkin_depois_horas numeric(4, 2) not null check (janela_checkin_depois_horas > 0),
  criado_em timestamptz not null default now(),
  constraint turmas_dias_semana_check
    check (array_length(dias_semana, 1) > 0 and dias_semana <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])
);

alter table profiles
  add constraint profiles_turma_principal_fk
  foreign key (turma_principal_id) references turmas (id) on delete set null;

create table checkins (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references profiles (id) on delete cascade,
  turma_id uuid not null references turmas (id) on delete cascade,
  academia_id uuid not null references academias (id) on delete cascade,
  data date not null,
  avulso boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (aluno_id, turma_id, data)
);

create table formularios (
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references academias (id) on delete cascade,
  nome text not null,
  padrao boolean not null default false,
  criado_em timestamptz not null default now()
);

create table perfil_campos (
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references academias (id) on delete cascade,
  formulario_id uuid not null references formularios (id) on delete cascade,
  label text not null,
  tipo text not null check (tipo in (
    'texto_curto', 'texto_longo', 'numero', 'multipla_escolha',
    'caixa_selecao', 'lista_suspensa', 'data', 'documento'
  )),
  obrigatorio boolean not null default false,
  opcoes text[],
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

create table perfil_respostas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references profiles (id) on delete cascade,
  campo_id uuid not null references perfil_campos (id) on delete cascade,
  valor_texto text,
  arquivo_url text,
  atualizado_em timestamptz not null default now(),
  unique (aluno_id, campo_id)
);

create table faixas_config (
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references academias (id) on delete cascade,
  nome text not null,
  ordem integer not null,
  tipo_turma tipo_turma not null,
  -- null = faixa não conta aulas para grau (caso da faixa preta, que não tem
  -- "próxima faixa" nesse sistema)
  aulas_por_grau integer check (aulas_por_grau is null or aulas_por_grau > 0),
  graus_por_faixa integer check (graus_por_faixa is null or graus_por_faixa > 0),
  criado_em timestamptz not null default now(),
  unique (academia_id, tipo_turma, ordem)
);

create table graduacoes (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references profiles (id) on delete cascade,
  faixa_id uuid not null references faixas_config (id),
  grau integer,
  concedido_por uuid not null references profiles (id),
  concedido_em date not null default current_date,
  observacao text,
  criado_em timestamptz not null default now()
);

create table exames_medicos (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null unique references profiles (id) on delete cascade,
  academia_id uuid not null references academias (id) on delete cascade,
  status exame_medico_status not null default 'pendente',
  emitido_em date,
  validade date,
  arquivo_url text,
  solicitado_em timestamptz not null default now(),
  aprovado_por uuid references profiles (id),
  aprovado_em timestamptz,
  atualizado_por uuid not null references profiles (id),
  atualizado_em timestamptz not null default now()
);

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

-- ── Índices ───────────────────────────────────────────────────────────

create index checkins_aluno_data_idx on checkins (aluno_id, data desc);
create index checkins_turma_data_idx on checkins (turma_id, data desc);
create index turmas_academia_idx on turmas (academia_id);
create index graduacoes_aluno_idx on graduacoes (aluno_id, concedido_em desc);
create index perfil_respostas_aluno_idx on perfil_respostas (aluno_id);

create unique index formularios_um_padrao_por_academia
  on formularios (academia_id)
  where padrao;
create index formularios_academia_idx on formularios (academia_id);
create index perfil_campos_formulario_idx on perfil_campos (formulario_id);

create index faixas_config_academia_idx on faixas_config (academia_id, tipo_turma, ordem);
create index exames_medicos_academia_idx on exames_medicos (academia_id);
create index aulas_canceladas_academia_idx on aulas_canceladas (academia_id);
create index aulas_canceladas_turma_idx on aulas_canceladas (turma_id, data);

-- ── Funções auxiliares (SECURITY DEFINER, bypassam RLS de propósito) ────
-- Evitam recursão nas policies de `profiles` e resolvem o academia_id/role
-- do usuário logado sem expor a tabela inteira.

create or replace function auth_academia_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select academia_id from profiles where id = auth.uid();
$$;

create or replace function auth_role()
returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

grant execute on function auth_academia_id() to authenticated;
grant execute on function auth_role() to authenticated;

-- Trava role/academia_id contra alteração depois do onboarding, pra evitar
-- que um aluno se promova a professor ou pule de academia editando o próprio perfil.

create or replace function prevent_profile_privilege_escalation()
returns trigger
language plpgsql as $$
begin
  if new.role <> old.role or new.academia_id <> old.academia_id then
    raise exception 'não é permitido alterar role ou academia_id do perfil';
  end if;
  return new;
end;
$$;

create trigger profiles_no_privilege_escalation
  before update on profiles
  for each row execute function prevent_profile_privilege_escalation();

create or replace function set_atualizado_em()
returns trigger
language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger perfil_respostas_set_atualizado_em
  before update on perfil_respostas
  for each row execute function set_atualizado_em();

create trigger exames_medicos_set_atualizado_em
  before update on exames_medicos
  for each row execute function set_atualizado_em();

-- Só o professor pode marcar o exame médico como aprovado ou definir a
-- validade — o aluno só consegue deixar a própria submissão como
-- "pendente", sem validade.
create or replace function prevent_exame_autoaprovacao()
returns trigger
language plpgsql as $$
begin
  if auth_role() = 'professor' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'aprovado' or new.validade is not null then
      raise exception 'somente o professor pode aprovar o exame médico';
    end if;
  else
    if new.status = 'aprovado' and old.status <> 'aprovado' then
      raise exception 'somente o professor pode aprovar o exame médico';
    end if;
    if new.validade is distinct from old.validade then
      raise exception 'somente o professor pode definir a validade do exame médico';
    end if;
  end if;

  return new;
end;
$$;

create trigger exames_medicos_no_autoaprovacao
  before insert or update on exames_medicos
  for each row execute function prevent_exame_autoaprovacao();

-- Login por telefone usa um e-mail técnico interno (nunca recebe envio de
-- verdade) — como não há como confirmar por e-mail nesse caso, autoconfirma
-- na hora do cadastro. Ver src/lib/identificador.ts.
create or replace function auth_confirmar_telefone_tecnico()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email like '%@telefone.tatamepass.app' then
    new.email_confirmed_at = now();
  end if;
  return new;
end;
$$;

create trigger auth_users_confirmar_telefone
  before insert on auth.users
  for each row execute function auth_confirmar_telefone_tecnico();

-- Onboarding: criação de academia (professor) e resolução de código de
-- convite (aluno) precisam rodar fora da RLS normal, já que o usuário
-- ainda não tem uma linha em `profiles` nesse momento. Já semeia o
-- formulário de perfil padrão e a sequência de faixas da academia nova.

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

create or replace function resolve_convite(p_codigo text)
returns table (academia_id uuid, nome text)
language sql stable security definer set search_path = public as $$
  select id, nome from academias where codigo_convite = p_codigo;
$$;

grant execute on function create_academia(text, text) to authenticated;
grant execute on function resolve_convite(text) to authenticated;

-- ── Row Level Security ───────────────────────────────────────────────────

alter table academias enable row level security;
alter table profiles enable row level security;
alter table turmas enable row level security;
alter table checkins enable row level security;
alter table formularios enable row level security;
alter table perfil_campos enable row level security;
alter table perfil_respostas enable row level security;
alter table faixas_config enable row level security;
alter table graduacoes enable row level security;
alter table exames_medicos enable row level security;
alter table aulas_canceladas enable row level security;

-- academias: só membros leem a própria; criação é só via create_academia().
create policy "academias_select_propria" on academias
  for select using (id = auth_academia_id());

-- profiles: leitura de todos os perfis da mesma academia (professor precisa
-- ver a lista de alunos; aluno também enxerga colegas/professor da turma).
create policy "profiles_select_mesma_academia" on profiles
  for select using (academia_id = auth_academia_id());

create policy "profiles_insert_proprio" on profiles
  for insert to authenticated with check (id = auth.uid());

create policy "profiles_update_proprio" on profiles
  for update using (id = auth.uid());

-- turmas: leitura por qualquer membro da academia; escrita só por professor.
create policy "turmas_select_mesma_academia" on turmas
  for select using (academia_id = auth_academia_id());

create policy "turmas_write_professor" on turmas
  for all using (academia_id = auth_academia_id() and auth_role() = 'professor')
  with check (academia_id = auth_academia_id() and auth_role() = 'professor');

-- checkins: aluno lê/insere/cancela os próprios (cancela só no mesmo dia);
-- professor lê todos da academia.
create policy "checkins_select" on checkins
  for select using (
    academia_id = auth_academia_id()
    and (aluno_id = auth.uid() or auth_role() = 'professor')
  );

create policy "checkins_insert_proprio" on checkins
  for insert to authenticated with check (
    academia_id = auth_academia_id() and aluno_id = auth.uid()
  );

create policy "checkins_delete_proprio" on checkins
  for delete to authenticated using (aluno_id = auth.uid() and data = current_date);

-- formularios: leitura por todos da academia; escrita só por professor.
create policy "formularios_select_mesma_academia" on formularios
  for select using (academia_id = auth_academia_id());

create policy "formularios_write_professor" on formularios
  for all using (academia_id = auth_academia_id() and auth_role() = 'professor')
  with check (academia_id = auth_academia_id() and auth_role() = 'professor');

-- perfil_campos: leitura por todos da academia; escrita só por professor.
create policy "perfil_campos_select_mesma_academia" on perfil_campos
  for select using (academia_id = auth_academia_id());

create policy "perfil_campos_write_professor" on perfil_campos
  for all using (academia_id = auth_academia_id() and auth_role() = 'professor')
  with check (academia_id = auth_academia_id() and auth_role() = 'professor');

-- perfil_respostas: aluno gerencia as próprias; professor só lê, da própria academia.
create policy "perfil_respostas_gerencia_proprio" on perfil_respostas
  for all using (aluno_id = auth.uid())
  with check (aluno_id = auth.uid());

create policy "perfil_respostas_select_professor" on perfil_respostas
  for select using (
    auth_role() = 'professor'
    and exists (
      select 1 from profiles p
      where p.id = perfil_respostas.aluno_id and p.academia_id = auth_academia_id()
    )
  );

-- faixas_config: leitura por todos da academia; só professor ajusta os
-- números (aulas_por_grau/graus_por_faixa) — sem insert/delete via app, a
-- sequência de faixas é semeada por create_academia().
create policy "faixas_config_select_mesma_academia" on faixas_config
  for select using (academia_id = auth_academia_id());

create policy "faixas_config_update_professor" on faixas_config
  for update using (academia_id = auth_academia_id() and auth_role() = 'professor')
  with check (academia_id = auth_academia_id() and auth_role() = 'professor');

-- graduacoes: leitura por todos da academia; só professor concede.
create policy "graduacoes_select_mesma_academia" on graduacoes
  for select using (
    exists (
      select 1 from profiles p
      where p.id = graduacoes.aluno_id and p.academia_id = auth_academia_id()
    )
  );

create policy "graduacoes_insert_professor" on graduacoes
  for insert to authenticated with check (
    auth_role() = 'professor'
    and concedido_por = auth.uid()
    and exists (
      select 1 from profiles p
      where p.id = graduacoes.aluno_id and p.academia_id = auth_academia_id()
    )
  );

-- exames_medicos: aluno vê/envia o próprio; professor vê/gerencia todos da
-- academia (aprovação/validade travadas pelo trigger acima).
create policy "exames_medicos_select" on exames_medicos
  for select using (
    academia_id = auth_academia_id() and (aluno_id = auth.uid() or auth_role() = 'professor')
  );

create policy "exames_medicos_insert" on exames_medicos
  for insert to authenticated with check (
    academia_id = auth_academia_id() and (aluno_id = auth.uid() or auth_role() = 'professor')
  );

create policy "exames_medicos_update" on exames_medicos
  for update using (
    academia_id = auth_academia_id() and (aluno_id = auth.uid() or auth_role() = 'professor')
  );

-- aulas_canceladas: leitura por todos da academia; só professor cancela/desfaz.
create policy "aulas_canceladas_select_mesma_academia" on aulas_canceladas
  for select using (academia_id = auth_academia_id());

create policy "aulas_canceladas_write_professor" on aulas_canceladas
  for all using (academia_id = auth_academia_id() and auth_role() = 'professor')
  with check (academia_id = auth_academia_id() and auth_role() = 'professor');

-- ── Storage: buckets e policies ──────────────────────────────────────────
-- Convenção de path: {academia_id}/{user_id}/arquivo.ext
-- (o documento do exame médico também usa o bucket "documentos")

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

create policy "avatars_leitura_publica" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_dono_insere" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth_academia_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "avatars_dono_atualiza" on storage.objects
  for update to authenticated using (
    bucket_id = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "documentos_leitura" on storage.objects
  for select to authenticated using (
    bucket_id = 'documentos'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or (auth_role() = 'professor' and (storage.foldername(name))[1] = auth_academia_id()::text)
    )
  );

create policy "documentos_dono_insere" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = auth_academia_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "documentos_dono_atualiza" on storage.objects
  for update to authenticated using (
    bucket_id = 'documentos' and (storage.foldername(name))[2] = auth.uid()::text
  );
