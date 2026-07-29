# Funcionalidades

Espelha o briefing do produto, marcando o que está implementado nesta versão do MVP.

## Visão geral

SaaS multi-tenant de gestão de presença para academias de luta. Cada academia se cadastra de forma independente (login e dados isolados entre academias). Uma unidade física por academia. Sem controle financeiro/mensalidade no MVP.

## Autenticação

- [x] Login/cadastro com Google (OAuth via Supabase Auth)
- [x] Login/cadastro com e-mail e senha (alternativa ao Google)

## Papéis de usuário

- **Aluno**
- **Professor** — opera o dia a dia (agenda, alunos, conceder graduação, aprovar exame médico); só visualiza turmas, não configura.
- **Admin** — dono/gestor da academia. Tudo do professor, mais: cadastro de turmas, formulário de perfil, faixas de graduação, e cadastro/promoção de professores. Pode haver mais de um admin por academia. Ver [decisoes.md](./decisoes.md).

## Funcionalidades do aluno

- [x] Check-in dentro de uma janela de tempo antes/depois da aula, configurável pelo admin por turma
- [x] Vínculo com uma turma principal, com check-in avulso em outras turmas (modelo híbrido)
- [x] Cancelar o próprio check-in do dia
- [x] Perfil com formulário customizável (múltiplos tipos de campo) definido pelo admin
- [x] Foto de perfil

## Funcionalidades do professor

- [x] Painel com todos os alunos e a presença de cada um, agenda mensal, cancelar aula com motivo
- [x] Concessão manual de graduação de faixa (sem regra automática por número de presenças)
- [x] Aprovação de exame médico

## Funcionalidades do admin (além de tudo do professor)

- [x] Cadastro de turmas: nome, horário, dias da semana, janela de check-in
- [x] Criação do formulário de perfil do aluno (campos de texto/documento/múltipla escolha, obrigatoriedade, ordem)
- [x] Links de convite (aluno e professor) prontos pra compartilhar
- [x] Cadastro/promoção de professores (promover a admin, rebaixar a professor)
- [x] Personalização de marca: cor de destaque e logo, aplicados no app pra quem é da academia

### Notificações — fora desta entrega

- [ ] Avisos gerais (mural)
- [ ] Alerta automático de aula
- [ ] Aviso de graduação
- [ ] Mensagem individual para um aluno

O usuário já usa um padrão próprio de notificações em outro app e vai integrá-lo depois; nada de schema ou UI para isso foi criado nesta rodada. Ver [decisoes.md](./decisoes.md).

## Fora de escopo (nesta versão)

- Financeiro/mensalidades
- Múltiplas unidades/filiais por academia
- Múltiplos professores por turma
- Regra automática de graduação
- Gráficos de frequência no dashboard do aluno
- Notificações (ver acima)

## Backlog (ideias futuras, não decididas)

- Alerta automático pro professor quando aluno fica X dias sem check-in (retenção/evasão)
- Linha do tempo de graduações (histórico de faixas/graus com data)
- Check-in avulso para visitante/aula experimental, sem cadastro completo (captação de lead)
- Exportar relatório de presença em PDF/Excel
- QR code como alternativa de check-in (fixo na recepção)
- Notificação de aniversário do aluno
- Requisito mínimo de presença configurável como referência (sem virar regra automática)
- Exportação/backup de dados da academia em caso de cancelamento de assinatura (LGPD)
