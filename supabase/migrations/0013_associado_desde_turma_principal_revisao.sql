-- TatamePass — data de associação, início no jiu-jitsu (auto-declarado pelo
-- aluno) e revisão do cadastro pelo staff. Turma principal e data de
-- associação passam a ser definidas só por professor/admin, não pelo aluno.
-- Rodar no SQL Editor do Supabase depois da 0012_tema_academia.sql.

alter table profiles
  add column associado_desde date,
  add column inicio_jiu_jitsu date,
  add column revisado_pelo_professor boolean not null default true;

update profiles set associado_desde = criado_em::date where associado_desde is null;

-- Trava por coluna (não pela linha inteira, que já tem policy própria de
-- update do dono) — mesmo padrão de `prevent_profile_privilege_escalation`
-- em 0001_init.sql, mas só bloqueia estas duas colunas específicas.

create or replace function prevent_aluno_editar_associado_desde()
returns trigger
language plpgsql as $$
begin
  if new.associado_desde is distinct from old.associado_desde and auth_role() not in ('professor', 'admin') then
    raise exception 'só professor ou admin pode alterar a data de associação';
  end if;
  return new;
end;
$$;

create trigger profiles_travar_associado_desde
  before update on profiles
  for each row execute function prevent_aluno_editar_associado_desde();

create or replace function prevent_aluno_editar_turma_principal()
returns trigger
language plpgsql as $$
begin
  if new.turma_principal_id is distinct from old.turma_principal_id and auth_role() not in ('professor', 'admin') then
    raise exception 'só professor ou admin pode alterar a turma principal';
  end if;
  return new;
end;
$$;

create trigger profiles_travar_turma_principal
  before update on profiles
  for each row execute function prevent_aluno_editar_turma_principal();

-- Sem essa policy, só o admin (profiles_update_admin, da 0010) e o próprio
-- dono (profiles_update_proprio) conseguem dar update em profiles — falta
-- o professor comum, que no dia a dia é quem mais mexe em turma
-- principal/data de associação/revisão de cadastro.
create policy "profiles_update_staff" on profiles
  for update using (academia_id = auth_academia_id() and auth_role() in ('professor', 'admin'))
  with check (academia_id = auth_academia_id() and auth_role() in ('professor', 'admin'));
