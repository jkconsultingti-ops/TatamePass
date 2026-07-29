-- TatamePass — personalização visual por academia: cor de destaque e logo,
-- aplicados no app pra quem já é membro (aluno/professor/admin).
-- Rodar no SQL Editor do Supabase depois da 0010_papel_admin_e_convites.sql.

alter table academias add column if not exists cor_marca text;
alter table academias add column if not exists logo_url text;

-- Não existia policy de update em academias até agora (só create_academia()
-- via RPC). Admin passa a poder atualizar a própria academia (hoje só usado
-- pra cor_marca/logo_url).
drop policy if exists "academias_update_admin" on academias;
create policy "academias_update_admin" on academias
  for update using (id = auth_academia_id() and auth_role() = 'admin')
  with check (id = auth_academia_id() and auth_role() = 'admin');

-- ── Storage: logo da academia ─────────────────────────────────────────────
-- Convenção de path: {academia_id}/logo.ext — só admin escreve, leitura é
-- pública (aparece no header do app pra todo mundo, inclusive não-membros
-- em telas futuras).

insert into storage.buckets (id, name, public)
values ('academia-branding', 'academia-branding', true)
on conflict (id) do nothing;

drop policy if exists "academia_branding_leitura_publica" on storage.objects;
create policy "academia_branding_leitura_publica" on storage.objects
  for select using (bucket_id = 'academia-branding');

drop policy if exists "academia_branding_admin_insere" on storage.objects;
create policy "academia_branding_admin_insere" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'academia-branding'
    and (storage.foldername(name))[1] = auth_academia_id()::text
    and auth_role() = 'admin'
  );

drop policy if exists "academia_branding_admin_atualiza" on storage.objects;
create policy "academia_branding_admin_atualiza" on storage.objects
  for update to authenticated using (
    bucket_id = 'academia-branding'
    and (storage.foldername(name))[1] = auth_academia_id()::text
    and auth_role() = 'admin'
  );
