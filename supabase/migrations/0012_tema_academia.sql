-- TatamePass — tema claro/escuro por academia (complementa a cor de marca
-- da 0011). Rodar no SQL Editor do Supabase depois da 0011_marca_academia.sql.

alter table academias add column if not exists tema text not null default 'escuro';

alter table academias drop constraint if exists academias_tema_check;
alter table academias add constraint academias_tema_check check (tema in ('escuro', 'claro'));
