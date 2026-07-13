-- TatamePass — turmas em múltiplos dias da semana + janela de check-in
-- antes do início e depois do término, em horas.
-- Rodar no SQL Editor do Supabase depois da 0004_tipos_de_campo.sql.

-- ── dia_semana (smallint) vira dias_semana (smallint[]) ─────────────────

alter table turmas add column dias_semana smallint[];

update turmas set dias_semana = array[dia_semana];

alter table turmas alter column dias_semana set not null;

alter table turmas
  add constraint turmas_dias_semana_check
  check (array_length(dias_semana, 1) > 0 and dias_semana <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);

alter table turmas drop column dia_semana;

-- ── janela_checkin_minutos (só depois do fim) vira duas janelas em horas ─

alter table turmas
  add column janela_checkin_antes_horas numeric(4, 2) not null default 0
  check (janela_checkin_antes_horas >= 0);

alter table turmas add column janela_checkin_depois_horas numeric(4, 2);

update turmas set janela_checkin_depois_horas = round(janela_checkin_minutos / 60.0, 2);

alter table turmas alter column janela_checkin_depois_horas set not null;

alter table turmas
  add constraint turmas_janela_depois_check check (janela_checkin_depois_horas > 0);

alter table turmas drop column janela_checkin_minutos;
