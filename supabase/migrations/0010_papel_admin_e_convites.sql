-- TatamePass — papel de admin da academia separado de professor, convite por
-- link (um pra aluno, um pra professor) em vez de código digitado.
-- Rodar no SQL Editor do Supabase depois da 0009_identificador_login.sql.
--
-- Ordem importa aqui, por três motivos do Postgres:
--   1. `create or replace function` NÃO muda tipo de retorno — auth_role()
--      (user_role -> text) e resolve_convite() (ganha a coluna `role`)
--      precisam de drop antes.
--   2. Só dá pra dropar auth_role() depois de dropar toda policy que a
--      chama na expressão USING/WITH CHECK (são 12, listadas abaixo).
--   3. A trigger antiga de profiles bloqueia qualquer troca de role — ela
--      precisa ser relaxada ANTES do UPDATE que promove os professores,
--      senão a migração barra a si mesma.

-- ── 1. Derruba toda policy que chama auth_role() ─────────────────────────

drop policy if exists "turmas_write_professor" on turmas;
drop policy if exists "checkins_select" on checkins;
drop policy if exists "formularios_write_professor" on formularios;
drop policy if exists "perfil_campos_write_professor" on perfil_campos;
drop policy if exists "perfil_respostas_select_professor" on perfil_respostas;
drop policy if exists "faixas_config_update_professor" on faixas_config;
drop policy if exists "graduacoes_insert_professor" on graduacoes;
drop policy if exists "aulas_canceladas_write_professor" on aulas_canceladas;
drop policy if exists "exames_medicos_select" on exames_medicos;
drop policy if exists "exames_medicos_insert" on exames_medicos;
drop policy if exists "exames_medicos_update" on exames_medicos;
drop policy if exists "documentos_leitura" on storage.objects;

drop function if exists auth_role();

-- ── 2. role vira text + check em vez de enum ─────────────────────────────
-- Mesmo motivo da 0004 com campo_tipo: o Postgres não deixa usar um valor
-- de enum recém-criado na mesma transação em que foi adicionado — e a gente
-- precisa usar 'admin' logo abaixo, pra promover quem já é professor.

alter table profiles alter column role type text using role::text;

drop type if exists user_role;

alter table profiles
  add constraint profiles_role_check check (role in ('aluno', 'professor', 'admin'));

create function auth_role()
returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

grant execute on function auth_role() to authenticated;

-- ── 3. Relaxa a trigger ANTES de promover ninguém ────────────────────────
-- Rodando aqui no SQL Editor não existe JWT de app, então auth.uid() é null
-- e auth_role() retorna null: a condição `and auth_role() <> 'admin'` vira
-- null e o `if` não dispara. Na app, com sessão de verdade, a checagem vale.

create or replace function prevent_profile_privilege_escalation()
returns trigger
language plpgsql as $$
begin
  if (new.role <> old.role or new.academia_id <> old.academia_id) and auth_role() <> 'admin' then
    raise exception 'não é permitido alterar role ou academia_id do perfil';
  end if;
  return new;
end;
$$;

-- Todo professor que já existe hoje é, na prática, o admin da academia dele
-- (o modelo antigo era "professor acumula admin") — promove todos.
update profiles set role = 'admin' where role = 'professor';

-- ── 4. Recria as 12 policies, já com a regra nova ────────────────────────
-- turmas/formularios/perfil_campos/faixas_config viram admin-only; o resto
-- (operação do dia a dia) aceita professor OU admin.

create policy "turmas_write_admin" on turmas
  for all using (academia_id = auth_academia_id() and auth_role() = 'admin')
  with check (academia_id = auth_academia_id() and auth_role() = 'admin');

create policy "checkins_select" on checkins
  for select using (
    academia_id = auth_academia_id()
    and (aluno_id = auth.uid() or auth_role() in ('professor', 'admin'))
  );

create policy "formularios_write_admin" on formularios
  for all using (academia_id = auth_academia_id() and auth_role() = 'admin')
  with check (academia_id = auth_academia_id() and auth_role() = 'admin');

create policy "perfil_campos_write_admin" on perfil_campos
  for all using (academia_id = auth_academia_id() and auth_role() = 'admin')
  with check (academia_id = auth_academia_id() and auth_role() = 'admin');

create policy "perfil_respostas_select_staff" on perfil_respostas
  for select using (
    auth_role() in ('professor', 'admin')
    and exists (
      select 1 from profiles p
      where p.id = perfil_respostas.aluno_id and p.academia_id = auth_academia_id()
    )
  );

create policy "faixas_config_update_admin" on faixas_config
  for update using (academia_id = auth_academia_id() and auth_role() = 'admin')
  with check (academia_id = auth_academia_id() and auth_role() = 'admin');

create policy "graduacoes_insert_staff" on graduacoes
  for insert to authenticated with check (
    auth_role() in ('professor', 'admin')
    and concedido_por = auth.uid()
    and exists (
      select 1 from profiles p
      where p.id = graduacoes.aluno_id and p.academia_id = auth_academia_id()
    )
  );

create policy "aulas_canceladas_write_staff" on aulas_canceladas
  for all using (academia_id = auth_academia_id() and auth_role() in ('professor', 'admin'))
  with check (academia_id = auth_academia_id() and auth_role() in ('professor', 'admin'));

create policy "exames_medicos_select" on exames_medicos
  for select using (
    academia_id = auth_academia_id()
    and (aluno_id = auth.uid() or auth_role() in ('professor', 'admin'))
  );

create policy "exames_medicos_insert" on exames_medicos
  for insert to authenticated with check (
    academia_id = auth_academia_id()
    and (aluno_id = auth.uid() or auth_role() in ('professor', 'admin'))
  );

create policy "exames_medicos_update" on exames_medicos
  for update using (
    academia_id = auth_academia_id()
    and (aluno_id = auth.uid() or auth_role() in ('professor', 'admin'))
  );

-- documentos: dono sempre lê o próprio; professor OU admin leem os da
-- própria academia (antes só professor — faltava incluir admin).
create policy "documentos_leitura" on storage.objects
  for select to authenticated using (
    bucket_id = 'documentos'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or (auth_role() in ('professor', 'admin') and (storage.foldername(name))[1] = auth_academia_id()::text)
    )
  );

-- Admin também pode atualizar qualquer perfil da própria academia (além de
-- cada um atualizar o próprio, que já existe desde a 0001) — é o que
-- permite promover/rebaixar outra pessoa pela app.
drop policy if exists "profiles_update_admin" on profiles;
create policy "profiles_update_admin" on profiles
  for update using (academia_id = auth_academia_id() and auth_role() = 'admin')
  with check (academia_id = auth_academia_id() and auth_role() = 'admin');

-- ── 5. Convite por link: um token pra aluno, um pra professor ────────────

alter table academias add column if not exists codigo_convite_professor text unique;

update academias
set codigo_convite_professor = upper(substr(md5(random()::text || id::text), 1, 7))
where codigo_convite_professor is null;

alter table academias alter column codigo_convite_professor set not null;

-- resolve_convite ganha a coluna `role` no retorno — muda o row type dos
-- OUT params, então precisa de drop antes (mesma trava do auth_role()).
drop function if exists resolve_convite(text);

create function resolve_convite(p_codigo text)
returns table (academia_id uuid, nome text, role text)
language sql stable security definer set search_path = public as $$
  select id, nome, 'aluno' from academias where codigo_convite = p_codigo
  union all
  select id, nome, 'professor' from academias where codigo_convite_professor = p_codigo;
$$;

-- A página de convite (pública) precisa mostrar "convite pra {academia} como
-- {papel}" antes da pessoa logar — só revela nome da academia e papel, nada
-- sensível, então libera pra anon também.
grant execute on function resolve_convite(text) to anon, authenticated;

-- create_academia passa de 2 pra 3 argumentos: assinatura nova, então isso
-- cria uma função ao lado da antiga (não substitui) — a antiga é removida
-- logo abaixo, pra não sobrar uma versão que cria academia sem o convite
-- de professor.
create or replace function create_academia(p_nome text, p_codigo text, p_codigo_professor text)
returns academias
language plpgsql security definer set search_path = public as $$
declare
  v_academia academias;
  v_formulario formularios;
begin
  insert into academias (nome, codigo_convite, codigo_convite_professor)
  values (p_nome, p_codigo, p_codigo_professor)
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

grant execute on function create_academia(text, text, text) to authenticated;

drop function if exists create_academia(text, text);

-- ── 6. Exame médico: professor OU admin aprovam (antes só professor) ─────

create or replace function prevent_exame_autoaprovacao()
returns trigger
language plpgsql as $$
begin
  if auth_role() in ('professor', 'admin') then
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
