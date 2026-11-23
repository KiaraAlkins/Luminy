# Luminy

Plataforma da agência Luminy: demandas, Kanban de redes sociais, calendário, painel inicial,
campanhas com QR Code, leads, portal do cliente e financeiro.

A documentação de produto (v2.0) fica no Claude Docs; o design, no Figma (arquivo Domus-Os,
página "Luminy — Telas v1").

## Como rodar

```bash
npm install
npm run dev
```

Sem as variáveis do Supabase, o app abre em **modo demonstração**, com dados fictícios.
Para conectar, copie `.env.example` para `.env.local` e preencha com os dados do projeto Supabase.

## Banco de dados

As migrações ficam em `supabase/migrations`. Todas as regras de acesso (quem vê qual cliente,
tarefas pessoais privadas, sigilo dos leads, jovem aprendiz sem leads) estão no banco, via RLS.

```bash
npm run test:db
```

Sobe um Postgres temporário, aplica as migrações e roda os testes de acesso de
`supabase/tests/rls_test.sql`. Precisa do Postgres 15+ instalado na máquina.

## Estrutura

- `src/components`: menu lateral, barra superior e componentes básicos (botão, chip, avatar, cartão)
- `src/pages`: telas. `/q/:slug` é o formulário público dos QR Codes, aberto sem login
- `src/lib`: conexão com o Supabase e sessão do usuário
- `supabase/migrations`: estrutura do banco e regras de acesso
