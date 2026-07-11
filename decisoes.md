# Decisões de arquitetura

Log das decisões tomadas na construção do MVP do TatamePass, com o raciocínio por trás de cada uma. Novas decisões relevantes devem ser adicionadas aqui conforme o projeto evolui.

## Multi-tenant: banco único + Row Level Security, não um banco por academia

O briefing original pedia "login e base de dados separados entre academias". Na prática, isolar fisicamente um banco Postgres por cliente exigiria provisionar um projeto Supabase novo por academia — caro e difícil de automatizar num SaaS self-serve. Optamos por um único projeto Supabase, com toda tabela carregando `academia_id` e políticas de RLS garantindo que cada usuário só acessa dados da própria academia. O isolamento lógico é equivalente ao físico do ponto de vista de segurança, e é o padrão recomendado pela própria Supabase para multi-tenancy.

## Onboarding via código de convite, não diretório público

Sem um marketplace de academias, um aluno não tem como "achar" a academia dele ao se cadastrar. Resolvido com um `codigo_convite` curto por academia (gerado na criação), que o professor compartilha com os alunos. O aluno digita o código no onboarding para se vincular. Isso não estava no briefing original — é uma decisão de implementação necessária para o modelo multi-tenant funcionar sem fricção.

## RPCs `SECURITY DEFINER` para criação de academia e resolução de convite

A criação de uma academia e a busca de uma academia pelo código de convite acontecem *antes* do usuário ter uma linha em `profiles` — ou seja, antes de existir um `academia_id` associado a ele. As políticas de RLS normais (que dependem do `academia_id` do usuário) não dão conta desse momento. As funções `create_academia()` e `resolve_convite()` rodam como `SECURITY DEFINER` (dono `postgres`, que tem `BYPASSRLS`), contornando a RLS *só* para essas duas operações pontuais, sem abrir a tabela `academias` inteira para leitura cross-tenant.

## Trigger contra escalonamento de privilégio em `profiles`

`profiles.role` e `profiles.academia_id` são graváveis pelo próprio usuário na criação (onboarding), mas depois disso não podem mudar — senão um aluno poderia se autopromover a professor editando o próprio perfil. Um trigger `BEFORE UPDATE` bloqueia qualquer tentativa de alterar essas duas colunas após o cadastro inicial.

## Notificações fora desta entrega

O briefing pedia push no app/webapp (mural, alerta de aula, aviso de graduação, mensagem individual). O usuário já tem um padrão de notificações usado em outro app dele e vai integrá-lo depois — por isso o schema e a UI de notificações não entraram nesta rodada do MVP. Nenhuma tabela ou tela para isso foi criada; ao integrar, provavelmente vale revisitar o modelo de dados de `turmas`/`checkins` para decidir os gatilhos (ex: lembrete de aula).

## Faixa como texto livre, não enum fixo

`graduacoes.faixa` é texto livre em vez de um enum de faixas de jiu-jitsu, porque a academia pode ser de outra modalidade (muay thai, por exemplo) com uma progressão de graduação diferente. O professor digita a faixa concedida; não há validação de progressão (ex: branca → azul → roxa) porque o briefing explicitly exclui regra automática de graduação — é sempre decisão manual do professor.

## Direção visual: metáfora de carimbo/caderneta de dojo

Em vez do gradiente roxo-azul genérico de SaaS ou do dark-mode-com-neon-accent, a identidade visual parte do próprio nome do produto: TatamePass é um "passe" que recebe carimbo a cada check-in. Paleta baseada em tinta hanko (vermelho), tatame (verde-jade) e papel/caderneta (bege, tons de tinta), com Fraunces (serifada) para títulos e Public Sans para o corpo — buscando uma leitura de "caderneta/certificado de dojo" em vez de painel de software genérico. A logomarca (`Stamp`) é literalmente um selo circular, reaproveitado como confirmação visual de check-in bem-sucedido.

## Login com e-mail/senha além do Google

O briefing original definia login com Google como requisito único. A pedido do usuário, adicionamos e-mail/senha como alternativa (tela de login com abas "Entrar"/"Criar conta" + botão do Google). Usa `supabase.auth.signInWithPassword`/`signUp` diretamente, sem tabela ou lógica extra — o Supabase Auth já cobre os dois métodos com a mesma tabela `auth.users`, e o restante do fluxo de onboarding (criar academia / entrar com código) é idêntico para ambos. Cadastro por e-mail fica sujeito à confirmação por e-mail conforme a configuração do projeto Supabase (ligada por padrão).

## Tailwind v4 com tokens de design customizados

Cores, fontes e nomes semânticos (`hanko`, `mat`, `paper`, `ink`, `rope`, `chalk`) são definidos como CSS custom properties dentro de um bloco `@theme` em `src/index.css`, que o Tailwind v4 transforma automaticamente em utilitários (`bg-hanko`, `text-mat-light` etc). Evita duplicar a paleta em um arquivo de config separado (Tailwind v4 é CSS-first) e mantém os tokens visíveis num único lugar.
