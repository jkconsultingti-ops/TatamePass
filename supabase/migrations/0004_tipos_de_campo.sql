-- TatamePass — mais tipos de campo no formulário de perfil (número, data,
-- múltipla escolha, caixa de seleção, lista suspensa), estilo Google Forms.
-- Rodar no SQL Editor do Supabase depois da 0003_formulario_padrao_completo.sql.

-- ── tipo vira text + check em vez de enum ────────────────────────────────
-- Evita a trava do Postgres de não poder usar um valor de enum recém-criado
-- na mesma transação em que foi adicionado — relevante porque a lista de
-- tipos deve continuar evoluindo.

alter table perfil_campos add column opcoes text[];

alter table perfil_campos alter column tipo type text using tipo::text;
drop type campo_tipo;

update perfil_campos set tipo = 'texto_curto' where tipo = 'texto';

alter table perfil_campos
  add constraint perfil_campos_tipo_check
  check (tipo in (
    'texto_curto', 'texto_longo', 'numero', 'multipla_escolha',
    'caixa_selecao', 'lista_suspensa', 'data', 'documento'
  ));

-- ── Bônus: "Tipo sanguíneo" (semeado pela 0003) vira lista suspensa ─────

update perfil_campos
set tipo = 'lista_suspensa',
    opcoes = array['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Não sei']
where label = 'Tipo sanguíneo' and tipo = 'texto_curto';

-- ── create_academia() semeia os campos padrão com os tipos certos ───────

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
    (v_academia.id, v_formulario.id, 'Atestado médico', 'documento', true, 11, null),
    (v_academia.id, v_formulario.id, 'Termo de responsabilidade', 'documento', true, 12, null);

  return v_academia;
end;
$$;
