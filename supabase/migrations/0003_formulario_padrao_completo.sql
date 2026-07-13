-- TatamePass — completa o formulário padrão com mais campos comuns de
-- cadastro (CPF, endereço, tipo sanguíneo, CPF do responsável legal).
-- Rodar no SQL Editor do Supabase depois da 0002_formularios.sql.
--
-- "Nome completo" não vira campo aqui de propósito: já existe em
-- profiles.nome (preenchido no onboarding, editável agora em /aluno/perfil).

-- ── Academias que já existem: adiciona só os campos novos no formulário
-- padrão de cada uma, sem duplicar o que já foi criado pela 0002.

do $$
declare
  r record;
  v_campos jsonb := '[
    {"label": "CPF", "tipo": "texto", "obrigatorio": true},
    {"label": "Endereço completo", "tipo": "texto", "obrigatorio": true},
    {"label": "Tipo sanguíneo", "tipo": "texto", "obrigatorio": false},
    {"label": "CPF do responsável legal (se menor de idade)", "tipo": "texto", "obrigatorio": false}
  ]'::jsonb;
  v_campo jsonb;
  v_proxima_ordem int;
begin
  for r in select f.id as formulario_id, f.academia_id from formularios f where f.padrao loop
    select coalesce(max(ordem), -1) + 1 into v_proxima_ordem
    from perfil_campos where formulario_id = r.formulario_id;

    for v_campo in select * from jsonb_array_elements(v_campos) loop
      if not exists (
        select 1 from perfil_campos
        where formulario_id = r.formulario_id and label = v_campo ->> 'label'
      ) then
        insert into perfil_campos (academia_id, formulario_id, label, tipo, obrigatorio, ordem)
        values (
          r.academia_id,
          r.formulario_id,
          v_campo ->> 'label',
          (v_campo ->> 'tipo')::campo_tipo,
          (v_campo ->> 'obrigatorio')::boolean,
          v_proxima_ordem
        );
        v_proxima_ordem := v_proxima_ordem + 1;
      end if;
    end loop;
  end loop;
end $$;

-- ── Academias novas: create_academia() semeia a lista completa direto ───

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
    (v_academia.id, v_formulario.id, 'CPF', 'texto', true, 1),
    (v_academia.id, v_formulario.id, 'Telefone', 'texto', true, 2),
    (v_academia.id, v_formulario.id, 'Endereço completo', 'texto', true, 3),
    (v_academia.id, v_formulario.id, 'Contato de emergência (nome e telefone)', 'texto', true, 4),
    (v_academia.id, v_formulario.id, 'Convênio médico ou plano de saúde', 'texto', false, 5),
    (v_academia.id, v_formulario.id, 'Tipo sanguíneo', 'texto', false, 6),
    (v_academia.id, v_formulario.id, 'Alergias ou condições de saúde', 'texto', false, 7),
    (v_academia.id, v_formulario.id, 'Nome do responsável legal (se menor de idade)', 'texto', false, 8),
    (v_academia.id, v_formulario.id, 'Telefone do responsável legal (se menor de idade)', 'texto', false, 9),
    (v_academia.id, v_formulario.id, 'CPF do responsável legal (se menor de idade)', 'texto', false, 10),
    (v_academia.id, v_formulario.id, 'Atestado médico', 'documento', true, 11),
    (v_academia.id, v_formulario.id, 'Termo de responsabilidade', 'documento', true, 12);

  return v_academia;
end;
$$;
