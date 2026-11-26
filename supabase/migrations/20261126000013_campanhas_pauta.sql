-- Luminy · Acervo de Pauta: campanhas e datas próprias do cliente (aparecem junto das datas da saúde)
create table public.campanhas_pauta (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  descricao text,
  cor text not null default '#3D2EF9',
  inicio date not null,
  fim date not null,
  anual boolean not null default false,            -- volta todo ano (ex.: aniversário do hospital)
  criado_por uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now(),
  constraint campanha_pauta_periodo check (fim >= inicio)
);
alter table public.campanhas_pauta enable row level security;
create policy campanhas_pauta_ver on public.campanhas_pauta for select to authenticated using (eh_membro_cliente(cliente_id));
create policy campanhas_pauta_criar on public.campanhas_pauta for insert to authenticated with check (eh_membro_cliente(cliente_id) and criado_por = auth.uid());
create policy campanhas_pauta_editar on public.campanhas_pauta for update to authenticated using (eh_membro_cliente(cliente_id)) with check (eh_membro_cliente(cliente_id));
create policy campanhas_pauta_apagar on public.campanhas_pauta for delete to authenticated using (eh_membro_cliente(cliente_id) and (criado_por = auth.uid() or eh_admin_cliente(cliente_id)));
