-- TatamePass — exame médico vira um fluxo dedicado de submissão + aprovação
-- (status, validade, só professor aprova), em vez do campo genérico
-- "Atestado médico" do formulário de perfil. Rodar depois de
-- 0007_faixas_graduacao_multitenant.sql.

create type exame_medico_status as enum ('pendente', 'aprovado');

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

create index exames_medicos_academia_idx on exames_medicos (academia_id);

create trigger exames_medicos_set_atualizado_em
  before update on exames_medicos
  for each row execute function set_atualizado_em();

-- Só o professor pode marcar como aprovado ou definir a validade — o aluno só
-- consegue deixar a própria submissão como "pendente", sem validade. Compara
-- com o valor anterior (em vez de só checar "não nulo") pra não bloquear um
-- reenvio do aluno quando já existe uma validade aprovada antes — nesse caso
-- o app não manda `validade` no upsert, então ela simplesmente não muda.
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

alter table exames_medicos enable row level security;

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

-- O campo genérico "Atestado médico" (documento, seedado pela 0003/0004) fica
-- redundante agora que existe este fluxo dedicado — remove das academias já
-- existentes (cascade apaga as respostas já enviadas por esse campo; quem já
-- enviou reenvia pelo fluxo novo). create_academia() já não semeia mais esse
-- campo desde a 0007.
delete from perfil_campos where label = 'Atestado médico';
