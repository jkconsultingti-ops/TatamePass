-- TatamePass — login por telefone (sem SMS), como alternativa ao e-mail/senha
-- e ao Google que já existem. A "identidade" técnica no Supabase Auth continua
-- sendo um e-mail (obrigatório pela própria plataforma), mas quando o usuário
-- escolhe telefone, o telefone normalizado vira um e-mail técnico de domínio
-- interno que nunca é exibido nem recebe envios de verdade — ver
-- src/lib/identificador.ts. Rodar depois de 0008_exames_medicos.sql.

create type identificador_tipo as enum ('email', 'telefone');

alter table profiles add column identificador_tipo identificador_tipo;
alter table profiles add column identificador_valor text;

-- Cadastro por e-mail comum continua exigindo confirmação por e-mail de
-- verdade (signUp padrão do Supabase). Cadastro por telefone não tem como
-- confirmar (o domínio técnico não recebe e-mails), então autoconfirma na
-- hora — a "garantia de identidade" nesse caso não vem de um OTP, e sim do
-- próprio fluxo de onboarding (ver decisoes.md sobre o modelo de ameaça).
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
