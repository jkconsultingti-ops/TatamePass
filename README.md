# TatamePass

SaaS multi-tenant de controle de presença para academias de luta (jiu-jitsu, muay thai etc). Cada academia tem seu próprio espaço isolado (alunos, turmas, formulário de perfil), login com Google, check-in por janela de tempo após a aula, e graduação de faixa concedida manualmente pelo professor.

Ver [funcionalidades.md](./funcionalidades.md) para o escopo completo e [decisoes.md](./decisoes.md) para o histórico de decisões de arquitetura.

## Stack

- [Vite](https://vite.dev/) + React 19 + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/) (`@tailwindcss/vite`)
- [Supabase](https://supabase.com/) — Postgres, Auth (Google OAuth), Storage
- [React Router](https://reactrouter.com/), [TanStack Query](https://tanstack.com/query), [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)

## Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha com os dados do seu projeto Supabase (Project Settings → API):

```bash
cp .env.example .env.local
```

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

### 3. Rodar a migração do banco

No painel do Supabase, abra o **SQL Editor** e execute o conteúdo de [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql) (ou use `supabase db push` se o projeto estiver linkado via CLI). Isso cria as tabelas, as políticas de RLS e os buckets de storage (`avatars`, `documentos`).

### 4. Configurar login

O app aceita **e-mail/senha** (funciona direto, sem configuração extra no Supabase) e **Google**. Para habilitar o Google: no painel do Supabase, **Authentication → Providers → Google**, habilite o provider e informe o Client ID/Secret de um OAuth Client criado no [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Nas URIs de redirecionamento autorizadas do Google Cloud, adicione a URL de callback que o Supabase mostra na mesma tela (`https://<seu-projeto>.supabase.co/auth/v1/callback`).

Em **Authentication → URL Configuration**, adicione a URL onde o app roda (ex: `http://localhost:5173` em dev, e o domínio da Vercel em produção) em *Site URL* e *Redirect URLs* — isso vale tanto para o Google quanto para o e-mail de confirmação de cadastro.

Por padrão, o Supabase exige confirmação de e-mail antes do primeiro login (**Authentication → Providers → Email → "Confirm email"**). Se quiser pular esse passo em desenvolvimento, desabilite essa opção; em produção, o recomendado é manter habilitada.

### 5. Rodar o app

```bash
npm run dev
```

## Scripts

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — typecheck + build de produção
- `npm run lint` — oxlint
- `npm run preview` — serve o build de produção localmente

## Onboarding (como funciona)

Não existe um diretório público de academias — o vínculo é feito por código de convite:

- **Professor**: no primeiro login, escolhe "criar academia". Um código de convite é gerado automaticamente e fica visível no painel do professor (`/professor`), pronto para compartilhar com os alunos.
- **Aluno**: no primeiro login, escolhe "entrar com um código" e informa o código recebido do professor.

## Deploy

O projeto está pronto para deploy na Vercel como um app Vite estático — basta importar o repositório e configurar as mesmas variáveis de ambiente (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) no painel do projeto. Lembre-se de adicionar o domínio final às *Redirect URLs* do Supabase Auth (passo 4 acima).
