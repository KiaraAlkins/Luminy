-- Luminy · Acervo de Pauta: banco de ideias da equipe, com votos e datas da saúde
create table public.pautas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  titulo text not null check (length(trim(titulo)) > 0),
  descricao text,
  tipo_conteudo text,
  tema text,
  data_ref text,                                   -- data da saúde ligada à ideia (ex.: 'novembro-azul')
  referencias jsonb not null default '[]',         -- [{id, nome, url}]
  reutilizavel boolean not null default false,     -- conteúdo que dá para repetir (ex.: todo ano)
  situacao text not null default 'ideia' check (situacao in ('ideia', 'usada', 'arquivada')),
  card_id uuid references public.cards (id) on delete set null,
  usada_em timestamptz,
  criado_por uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now()
);
create index on public.pautas (cliente_id, situacao);

create table public.pauta_votos (
  pauta_id uuid not null references public.pautas (id) on delete cascade,
  usuario_id uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now(),
  primary key (pauta_id, usuario_id)
);

alter table public.pautas enable row level security;
alter table public.pauta_votos enable row level security;
-- Toda a equipe vê, cria e edita ideias; apagar é de quem criou ou de administradores
create policy pautas_ver on public.pautas for select to authenticated using (eh_membro_cliente(cliente_id));
create policy pautas_criar on public.pautas for insert to authenticated with check (eh_membro_cliente(cliente_id) and criado_por = auth.uid());
create policy pautas_editar on public.pautas for update to authenticated using (eh_membro_cliente(cliente_id)) with check (eh_membro_cliente(cliente_id));
create policy pautas_apagar on public.pautas for delete to authenticated using (eh_membro_cliente(cliente_id) and (criado_por = auth.uid() or eh_admin_cliente(cliente_id)));

create policy votos_ver on public.pauta_votos for select to authenticated
  using (exists (select 1 from public.pautas p where p.id = pauta_id and eh_membro_cliente(p.cliente_id)));
create policy votos_dar on public.pauta_votos for insert to authenticated
  with check (usuario_id = auth.uid() and exists (select 1 from public.pautas p where p.id = pauta_id and eh_membro_cliente(p.cliente_id)));
create policy votos_tirar on public.pauta_votos for delete to authenticated using (usuario_id = auth.uid());
