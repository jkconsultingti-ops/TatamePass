-- TatamePass — schema inicial (multi-tenant via academia_id + RLS)
-- Rodar no SQL Editor do Supabase (ou `supabase db push`) em um projeto novo.

create extension if not exists "pgcrypto";

create type user_role as enum ('aluno', 'professor');
create type campo_tipo as enum ('texto', 'documento');

-- ── Tabelas ─────────────────────────────────────────────────────────────

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
  criado_em timestamptz not null default now()
);

create table turmas (
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references academias (id) on delete cascade,
  nome text not null,
  professor_id uuid not null references profiles (id),
  dia_semana smallint not null check (dia_semana between 0 and 6),
  horario_inicio time not null,
  horario_fim time not null,
  janela_checkin_minutos integer not null default 60 check (janela_checkin_minutos > 0),
  criado_em timestamptz not null default now()
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

create table perfil_campos (
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references academias (id) on delete cascade,
  label text not null,
  tipo campo_tipo not null,
  obrigatorio boolean not null default false,
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

create table graduacoes (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references profiles (id) on delete cascade,
  faixa text not null,
  grau integer,
  concedido_por uuid not null references profiles (id),
  concedido_em date not null default current_date,
  observacao text,
  criado_em timestamptz not null default now()
);

create index checkins_aluno_data_idx on checkins (aluno_id, data desc);
create index checkins_turma_data_idx on checkins (turma_id, data desc);
create index turmas_academia_idx on turmas (academia_id);
create index graduacoes_aluno_idx on graduacoes (aluno_id, concedido_em desc);
create index perfil_respostas_aluno_idx on perfil_respostas (aluno_id);

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

-- Onboarding: criação de academia (professor) e resolução de código de
-- convite (aluno) precisam rodar fora da RLS normal, já que o usuário
-- ainda não tem uma linha em `profiles` nesse momento.

create or replace function create_academia(p_nome text, p_codigo text)
returns academias
language plpgsql security definer set search_path = public as $$
declare
  v_academia academias;
begin
  insert into academias (nome, codigo_convite) values (p_nome, p_codigo)
  returning * into v_academia;
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

-- ── Row Level Security ───────────────────────────────────────────────────

alter table academias enable row level security;
alter table profiles enable row level security;
alter table turmas enable row level security;
alter table checkins enable row level security;
alter table perfil_campos enable row level security;
alter table perfil_respostas enable row level security;
alter table graduacoes enable row level security;

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

-- checkins: aluno lê/insere os próprios; professor lê todos da academia.
create policy "checkins_select" on checkins
  for select using (
    academia_id = auth_academia_id()
    and (aluno_id = auth.uid() or auth_role() = 'professor')
  );

create policy "checkins_insert_proprio" on checkins
  for insert to authenticated with check (
    academia_id = auth_academia_id() and aluno_id = auth.uid()
  );

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

-- ── Storage: buckets e policies ──────────────────────────────────────────
-- Convenção de path: {academia_id}/{user_id}/arquivo.ext

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
