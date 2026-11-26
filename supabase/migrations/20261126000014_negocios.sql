-- Luminy · Negócios do marketing do cliente: fornecedores, orçamentos (cotações), verba, gastos e contratos.
-- Tudo restrito aos administradores do cliente (a equipe e o portal não veem valores).

create table public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  categoria text,
  contato text,
  telefone text,
  email text,
  observacoes text,
  nota smallint check (nota between 1 and 5),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  fornecedor_id uuid references public.fornecedores (id) on delete set null,
  titulo text not null check (length(trim(titulo)) > 0),   -- objeto do contrato
  categoria text,
  valor numeric(12, 2) not null default 0 check (valor >= 0),
  periodicidade text not null default 'mensal' check (periodicidade in ('mensal', 'anual', 'unico')),
  inicio date not null,
  fim date,
  renovacao_automatica boolean not null default false,
  aviso_dias smallint not null default 60 check (aviso_dias between 0 and 365),
  situacao text not null default 'vigente' check (situacao in ('vigente', 'para_assinar', 'encerrado')),
  arquivo_path text,
  observacoes text,
  criado_em timestamptz not null default now(),
  constraint contrato_periodo check (fim is null or fim >= inicio)
);

create table public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  titulo text not null check (length(trim(titulo)) > 0),
  descricao text,
  categoria text,
  prazo date,                                               -- até quando precisa decidir
  situacao text not null default 'cotando' check (situacao in ('cotando', 'aprovado', 'cancelado')),
  cotacao_escolhida uuid,
  criado_por uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now()
);

create table public.cotacoes (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos (id) on delete cascade,
  fornecedor_id uuid references public.fornecedores (id) on delete set null,
  fornecedor_nome text,                                     -- quando ainda não é um fornecedor cadastrado
  valor numeric(12, 2) not null check (valor >= 0),
  prazo_entrega text,
  observacao text,
  arquivo_path text,
  criado_em timestamptz not null default now()
);

create table public.verbas (
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  mes date not null check (extract(day from mes) = 1),      -- primeiro dia do mês
  valor numeric(12, 2) not null check (valor >= 0),
  primary key (cliente_id, mes)
);

create table public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  data date not null,
  descricao text not null check (length(trim(descricao)) > 0),
  categoria text,
  valor numeric(12, 2) not null check (valor > 0),
  situacao text not null default 'previsto' check (situacao in ('previsto', 'pago')),
  fornecedor_id uuid references public.fornecedores (id) on delete set null,
  orcamento_id uuid references public.orcamentos (id) on delete set null,
  contrato_id uuid references public.contratos (id) on delete set null,
  comprovante_path text,
  observacao text,
  criado_por uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now()
);
create index on public.lancamentos (cliente_id, data);

alter table public.fornecedores enable row level security;
alter table public.contratos enable row level security;
alter table public.orcamentos enable row level security;
alter table public.cotacoes enable row level security;
alter table public.verbas enable row level security;
alter table public.lancamentos enable row level security;

create policy fornecedores_admin on public.fornecedores for all to authenticated using (eh_admin_cliente(cliente_id)) with check (eh_admin_cliente(cliente_id));
create policy contratos_admin on public.contratos for all to authenticated using (eh_admin_cliente(cliente_id)) with check (eh_admin_cliente(cliente_id));
create policy orcamentos_admin on public.orcamentos for all to authenticated using (eh_admin_cliente(cliente_id)) with check (eh_admin_cliente(cliente_id));
create policy verbas_admin on public.verbas for all to authenticated using (eh_admin_cliente(cliente_id)) with check (eh_admin_cliente(cliente_id));
create policy lancamentos_admin on public.lancamentos for all to authenticated using (eh_admin_cliente(cliente_id)) with check (eh_admin_cliente(cliente_id));
create policy cotacoes_admin on public.cotacoes for all to authenticated
  using (exists (select 1 from public.orcamentos o where o.id = orcamento_id and eh_admin_cliente(o.cliente_id)))
  with check (exists (select 1 from public.orcamentos o where o.id = orcamento_id and eh_admin_cliente(o.cliente_id)));

-- Contratos em PDF, propostas e comprovantes: armazenamento PRIVADO, pasta por cliente, só administradores
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('negocios', 'negocios', false, 20971520)
    on conflict (id) do update set public = false;
    execute $p$ create policy negocios_ver on storage.objects for select to authenticated
      using (bucket_id = 'negocios' and public.eh_admin_cliente(((storage.foldername(name))[1])::uuid)) $p$;
    execute $p$ create policy negocios_enviar on storage.objects for insert to authenticated
      with check (bucket_id = 'negocios' and public.eh_admin_cliente(((storage.foldername(name))[1])::uuid)) $p$;
    execute $p$ create policy negocios_apagar on storage.objects for delete to authenticated
      using (bucket_id = 'negocios' and public.eh_admin_cliente(((storage.foldername(name))[1])::uuid)) $p$;
  end if;
end $$;
