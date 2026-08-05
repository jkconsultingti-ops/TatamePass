-- TatamePass — exclusão de conta do aluno (LGPD), só pra admin da própria
-- academia. Rodar no SQL Editor do Supabase depois da
-- 0013_associado_desde_turma_principal_revisao.sql.

-- Sem policy de delete em storage.objects até aqui — precisa pra limpar
-- avatar/documentos do aluno antes de apagar a conta. Caminho de 2 níveis
-- ({academia_id}/{user_id}/arquivo), igual às policies de insert/update já
-- existentes desde 0001_init.sql.

create policy "avatars_dono_ou_admin_apaga" on storage.objects
  for delete to authenticated using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth_academia_id()::text
    and ((storage.foldername(name))[2] = auth.uid()::text or auth_role() = 'admin')
  );

create policy "documentos_dono_ou_admin_apaga" on storage.objects
  for delete to authenticated using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = auth_academia_id()::text
    and ((storage.foldername(name))[2] = auth.uid()::text or auth_role() = 'admin')
  );

-- security definer: roda com o privilégio do dono da função (o role usado
-- pra aplicar migrations, que já tem acesso de escrita em auth.users) — não
-- precisa de Admin API/service role separada por fora do banco. A validação
-- interna (só admin, só aluno da própria academia) é a barreira de segurança
-- real, já que a função ignora RLS.
create or replace function excluir_aluno(p_aluno_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth_role() <> 'admin' then
    raise exception 'só um administrador pode excluir a conta de um aluno';
  end if;

  if not exists (
    select 1 from profiles
    where id = p_aluno_id and role = 'aluno' and academia_id = auth_academia_id()
  ) then
    raise exception 'aluno não encontrado na sua academia';
  end if;

  delete from auth.users where id = p_aluno_id;
end;
$$;

grant execute on function excluir_aluno(uuid) to authenticated;
