-- Luminy · planos de saúde (convênios) cadastrados por cliente, com logo
-- As empresas e os leads continuam guardando o NOME do plano; o cadastro dá o logo e a lista para escolher.

create table public.convenios (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nome text not null check (length(trim(nome)) between 2 and 60),
  foto_url text,
  criado_em timestamptz not null default now()
);
create unique index convenios_nome_unico on public.convenios (cliente_id, lower(nome));

alter table public.convenios enable row level security;
create policy convenios_ver on public.convenios for select to authenticated using (eh_membro_cliente(cliente_id));
create policy convenios_criar on public.convenios for insert to authenticated with check (eh_membro_cliente(cliente_id));
create policy convenios_editar on public.convenios for update to authenticated using (eh_membro_cliente(cliente_id)) with check (eh_membro_cliente(cliente_id));
create policy convenios_excluir on public.convenios for delete to authenticated using (eh_admin_cliente(cliente_id));
-- Os logos ficam no mesmo armazenamento das fotos das empresas: <cliente_id>/convenios/<arquivo>
