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

## Rewrite de SPA no `vercel.json`

Abrir uma rota direta (`/login`, `/aluno`, `/professor` etc) na Vercel sem esse arquivo devolve 404, porque não existe um arquivo físico com esse nome — o roteamento é todo client-side via React Router, só existe depois que o `index.html` carrega o JS. `vercel.json` com um rewrite de qualquer caminho para `/index.html` resolve; sem isso, o app só funciona abrindo exatamente a raiz do domínio.

## Papel de admin separado de professor (substitui "professor acumula admin")

O briefing original definia só dois papéis, com o professor acumulando admin. A pedido do usuário, viraram três: `admin` (configura turmas, formulário de perfil, faixas de graduação, cadastra/promove professores), `professor` (opera o dia a dia — agenda, alunos, conceder graduação, aprovar exame médico — mas só *visualiza* turmas) e `aluno`. Todo `professor` que já existia na base foi promovido a `admin` na migração (ele já era o dono de fato da academia sob o modelo antigo). Pode haver mais de um admin por academia; um admin promove/rebaixa outros via `/admin/professores`. Telas que fazem sentido pros dois papéis (agenda, lista/detalhe de alunos, conceder graduação) não foram duplicadas — o mesmo componente é montado em duas rotas (`/professor/...` e `/admin/...`), cada uma atrás do `ProtectedRoute` do papel correspondente.

## Convite por link em vez de código digitado

Antes o aluno digitava um `codigo_convite` manualmente no onboarding. Virou um link (`/convite/:codigo`) que a academia manda pronto — um pra aluno, um pra professor (`academias.codigo_convite_professor`, novo). A RPC `resolve_convite` passa a devolver também o papel resolvido (bate com `codigo_convite` → aluno, com `codigo_convite_professor` → professor) e ficou liberada pra `anon` além de `authenticated`, pra a página do convite conseguir mostrar "convite pra {academia} como {papel}" antes da pessoa logar — só expõe nome da academia e papel, nada sensível. A tela de login principal (`/login`) só oferece "criar uma academia" como caminho de entrada nova; virar aluno ou professor só acontece por quem recebeu o link específico.

## `profiles.role` e `perfil_campos.tipo` como text+check, não enum

Os dois começaram como enum do Postgres, mas viraram `text` com `check` constraint (primeiro `perfil_campos.tipo`, depois `profiles.role`) pelo mesmo motivo: o Postgres não deixa usar um valor de enum recém-adicionado (`ALTER TYPE ... ADD VALUE`) na mesma transação em que ele foi criado — trava real quando a migração também precisa *usar* o valor novo (ex: promover todo `professor` existente pra `admin` na mesma migração que introduziu `admin`). `text + check` não tem essa restrição e é igual de fácil de validar.

## Formulário de perfil como gate bloqueante no onboarding do aluno

Antes, o formulário configurado pelo admin (`perfil_campos`) só existia como tela de edição em `/aluno/perfil`, com salvar por campo — a academia configurava campos obrigatórios e nunca recebia resposta, porque nada obrigava o aluno a visitar aquela tela. Agora existe `usePerfilCompleto()` (`src/lib/formularios.ts`), que checa se `profiles.nome` e todo campo `obrigatorio` do formulário padrão têm resposta, e uma rota-gate `PerfilCompletoRoute` (`src/auth/ProtectedRoute.tsx`) que envolve as rotas de aluno: enquanto `usePerfilCompleto()` não estiver completo, qualquer navegação para `/aluno/*` redireciona pra `/aluno/completar-perfil` (tela nova, fora do `AlunoLayout` — sem menu, pra não dar pra escapar do gate). Isso também corrige de passagem alunos com `nome` vazio (quem se cadastra por e-mail/telefone, já que `ConviteEntrar.tsx` só pega nome do metadata do Google) — o gate força a pessoa a digitar o nome antes de liberar o dashboard. Professor e admin não são afetados; o gate só embrulha as rotas de aluno.

## Cadastro por convite encadeado direto no "completar perfil"

Inspirado no fluxo de convite do Leões de Judá (outro app do usuário): lá o aceite de convite é um único formulário com seções (Conta → Dados pessoais → Médico) enviado de uma vez. No TatamePass isso não dá pra replicar de forma atômica porque a RLS de `perfil_respostas` e do bucket `documentos` depende de `auth_academia_id()`, que só resolve depois que a linha em `profiles` já existe — não dá pra fazer upload de documento ou responder o formulário customizado antes de ter conta criada. A solução foi encadear as duas telas que já existiam: `ConviteEntrar.tsx` cria o profile "básico" (nome vindo do Google, se houver) e, pra quem entra como aluno, navega direto pra `/aluno/completar-perfil` em vez de `/aluno` — sem passar pelo dashboard incompleto no meio do caminho. As duas telas reaproveitam os mesmos componentes (`Card`, `Label`, rótulo de seção em maiúsculo tipo `Conta`/`Seus dados`), então a experiência lê como uma sequência única, mesmo sendo duas rotas. `signInWithGoogle` também passou a usar `window.location.href` (em vez de `origin` fixo) no redirect, senão o OAuth perdia o `:codigo` do convite no caminho de volta.

## Tailwind v4 com tokens de design customizados

Cores, fontes e nomes semânticos (`hanko`, `mat`, `paper`, `ink`, `rope`, `chalk`) são definidos como CSS custom properties dentro de um bloco `@theme` em `src/index.css`, que o Tailwind v4 transforma automaticamente em utilitários (`bg-hanko`, `text-mat-light` etc). Evita duplicar a paleta em um arquivo de config separado (Tailwind v4 é CSS-first) e mantém os tokens visíveis num único lugar.
