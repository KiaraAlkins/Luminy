-- Luminy · Notas fiscais do marketing: de onde é cada nota (outdoor, lona, evento…), e o caminho dela:
-- recebida → assinada → digitalizada → entregue ao almoxarifado. Contratos ganham "referente a" e "nota todo mês".

alter table public.contratos
  add column referente_tipo text check (referente_tipo in ('outdoor', 'evento', 'material', 'servico', 'outro')),
  add column referente text,
  add column nota_mensal boolean not null default false;     -- chega nota todo mês (ex.: aluguel de outdoor)

create table public.notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  numero text,
  fornecedor_id uuid references public.fornecedores (id) on delete set null,
  fornecedor_nome text,                                     -- quando o fornecedor não está cadastrado
  contrato_id uuid references public.contratos (id) on delete set null,
  valor numeric(12, 2) check (valor >= 0),
  emissao date,
  competencia date not null check (extract(day from competencia) = 1),   -- mês a que a nota se refere
  referente_tipo text not null default 'servico' check (referente_tipo in ('outdoor', 'evento', 'material', 'servico', 'outro')),
  referente text,                                           -- ex.: "Outdoor Av. Central, ponto 12 · Novembro Azul"
  evento_id uuid references public.eventos (id) on delete set null,
  recebida_em date not null default current_date,
  recebida_por uuid default auth.uid() references auth.users (id),
  assinada_em timestamptz,
  assinada_por uuid references auth.users (id),
  arquivo_path text,                                        -- nota digitalizada
  digitalizada_em timestamptz,
  entregue_em timestamptz,
  entregue_por uuid references auth.users (id),
  entregue_para text,                                       -- quem recebeu no almoxarifado
  protocolo text,
  lancamento_id uuid references public.lancamentos (id) on delete set null,
  observacao text,
  criado_por uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now()
);
create index on public.notas_fiscais (cliente_id, competencia);

alter table public.notas_fiscais enable row level security;
create policy notas_admin on public.notas_fiscais for all to authenticated using (eh_admin_cliente(cliente_id)) with check (eh_admin_cliente(cliente_id));
