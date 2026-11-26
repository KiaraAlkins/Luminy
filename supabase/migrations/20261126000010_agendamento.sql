-- Luminy · Agendamento: fila de publicação e contas das redes do cliente

-- Quando e por quem o post foi publicado (e o link dele, se quiser guardar)
alter table public.cards
  add column postado_em timestamptz,
  add column postado_por uuid references auth.users (id),
  add column link_post text;

-- Contas das redes de cada cliente. Por enquanto a publicação é manual (o Luminy avisa e deixa tudo pronto);
-- quando a Meta liberar o aplicativo, a conta passa a "conectada" e os posts aprovados vão ao ar sozinhos.
create table public.contas_sociais (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  rede text not null check (rede in ('Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'YouTube')),
  usuario text,                                  -- @ da conta ou nome da página
  situacao text not null default 'manual' check (situacao in ('manual', 'aguardando', 'conectada')),
  conectada_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (cliente_id, rede)
);
alter table public.contas_sociais enable row level security;
create policy contas_ver on public.contas_sociais for select to authenticated using (eh_membro_cliente(cliente_id));
create policy contas_gerir on public.contas_sociais for all to authenticated using (eh_admin_cliente(cliente_id)) with check (eh_admin_cliente(cliente_id));
