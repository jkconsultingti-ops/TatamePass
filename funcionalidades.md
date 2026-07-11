# Funcionalidades

Espelha o briefing do produto, marcando o que está implementado nesta versão do MVP.

## Visão geral

SaaS multi-tenant de gestão de presença para academias de luta. Cada academia se cadastra de forma independente (login e dados isolados entre academias). Uma unidade física por academia. Sem controle financeiro/mensalidade no MVP.

## Autenticação

- [x] Login/cadastro com Google (OAuth via Supabase Auth)
- [x] Login/cadastro com e-mail e senha (alternativa ao Google)

## Papéis de usuário

- **Aluno**
- **Professor** — acumula a função de admin da academia. Não existe papel de "Dono" separado.

## Funcionalidades do aluno

- [x] Check-in dentro de uma janela de tempo após o fim da aula, configurável pelo professor por turma
- [x] Vínculo com uma turma principal, com check-in avulso em outras turmas (modelo híbrido)
- [x] Perfil com formulário customizável (campos de texto + upload de documentos) definido pelo professor
- [x] Foto de perfil
- [x] Dashboard: histórico de aulas frequentadas, faixa atual (lista simples, sem gráficos)

## Funcionalidades do professor (acumula admin)

- [x] Cadastro de turmas: nome, horário, professor responsável, janela de check-in
- [x] Criação do formulário de perfil do aluno (campos de texto/documento, obrigatoriedade, ordem)
- [x] Painel com todos os alunos e a presença de cada um
- [x] Concessão manual de graduação de faixa (sem regra automática por número de presenças)
- [x] Compartilhamento do código de convite da academia

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
