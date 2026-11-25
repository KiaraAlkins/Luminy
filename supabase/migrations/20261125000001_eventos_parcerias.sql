-- Luminy · Eventos e parcerias (CRM de empresas)
-- Empresas parceiras do cliente, seus contatos e planos de saúde, o histórico de tudo que foi
-- feito (brindes, eventos, coletas de leads, campanhas) e em que etapa está cada parceria.
-- Empresas, histórico e eventos: toda a equipe do cliente vê.
-- Leads e campanhas continuam restritos a quem tem acesso a leads.

create type public.etapa_parceria as enum
  ('prospeccao', 'primeiro_contato', 'reuniao', 'proposta', 'parceira_ativa', 'pausada', 'encerrada');
create type public.tipo_interacao as enum
  ('contato', 'reuniao', 'brinde', 'evento', 'coleta_leads', 'campanha', 'proposta', 'outro');
create type public.situacao_evento as enum ('planejado', 'confirmado', 'realizado', 'cancelado');

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nome text not null,
  cnpj text,
  segmento text,
  funcionarios int,
  endereco text,
  site text,
  -- Planos de saúde que os funcionários da empresa usam (ex.: Unimed, Bradesco Saúde)
  convenios text[] not null default '{}',
  etapa public.etapa_parceria not null default 'prospeccao',
  posicao double precision not null default 0,
  proximo_passo text,
  proximo_passo_em date,
  observacoes text,
  criado_por uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.contatos_empresa (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null,
  cargo text,
  email text,
  telefone text,
  principal boolean not null default false,
  criado_em timestamptz not null default now()
);

create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  empresa_id uuid references public.empresas (id) on delete set null,
  nome text not null,
  data date not null,
  hora time,
  local text,
  descricao text,
  situacao public.situacao_evento not null default 'planejado',
  criado_por uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now()
);

create table public.interacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  tipo public.tipo_interacao not null,
  titulo text not null,
  descricao text,
  data date not null default current_date,
  evento_id uuid references public.eventos (id) on delete set null,
  autor_id uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now()
);

-- Campanhas QR podem nascer de um evento e/ou de uma empresa parceira
alter table public.campanhas add column empresa_id uuid references public.empresas (id) on delete set null;
alter table public.campanhas add column evento_id uuid references public.eventos (id) on delete set null;

create index on public.empresas (cliente_id, etapa);
create index on public.empresas using gin (convenios);
create index on public.interacoes (empresa_id, data desc);
create index on public.eventos (cliente_id, data);

-- Mantém "atualizado_em" e registra mudança de etapa no histórico
create or replace function public.tg_empresa_atualizada()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;
create trigger empresa_atualizada before update on public.empresas
  for each row execute function public.tg_empresa_atualizada();

create or replace function public.tg_empresa_mudou_etapa()
returns trigger language plpgsql security definer set search_path = public as $$
declare rotulos jsonb := '{"prospeccao":"Prospecção","primeiro_contato":"Primeiro contato","reuniao":"Reunião",
  "proposta":"Proposta","parceira_ativa":"Parceira ativa","pausada":"Pausada","encerrada":"Encerrada"}';
begin
  if new.etapa is distinct from old.etapa then
    insert into interacoes (empresa_id, tipo, titulo, autor_id)
    values (new.id, 'outro', 'Etapa da parceria: ' || (rotulos->>old.etapa::text) || ' → ' || (rotulos->>new.etapa::text),
            coalesce(auth.uid(), new.criado_por));
  end if;
  return new;
end $$;
create trigger empresa_mudou_etapa after update of etapa on public.empresas
  for each row execute function public.tg_empresa_mudou_etapa();

-- Resumo para a lista e o quadro: última interação e, para quem pode ver leads, quantos leads vieram da empresa
create or replace function public.resumo_empresas(p_cliente uuid)
returns table (empresa_id uuid, ultima_interacao date, ultima_descricao text, total_interacoes bigint, total_leads bigint)
language sql stable security definer set search_path = public as $$
  select e.id,
         (select max(i.data) from interacoes i where i.empresa_id = e.id),
         (select i.titulo from interacoes i where i.empresa_id = e.id order by i.data desc, i.criado_em desc limit 1),
         (select count(*) from interacoes i where i.empresa_id = e.id),
         case when pode_ver_leads(p_cliente) then
           (select count(*) from leads l join campanhas c on c.id = l.campanha_id where c.empresa_id = e.id)
         end
  from empresas e
  where e.cliente_id = p_cliente and eh_membro_cliente(p_cliente);
$$;
revoke all on function public.resumo_empresas(uuid) from public, anon;
grant execute on function public.resumo_empresas(uuid) to authenticated;

-- RLS
alter table public.empresas enable row level security;
alter table public.contatos_empresa enable row level security;
alter table public.eventos enable row level security;
alter table public.interacoes enable row level security;

-- Toda a equipe do cliente consulta e registra; excluir empresa ou evento é só de administrador
create policy empresas_ver on public.empresas for select to authenticated using (eh_membro_cliente(cliente_id));
create policy empresas_criar on public.empresas for insert to authenticated with check (eh_membro_cliente(cliente_id));
create policy empresas_editar on public.empresas for update to authenticated
  using (eh_membro_cliente(cliente_id)) with check (eh_membro_cliente(cliente_id));
create policy empresas_excluir on public.empresas for delete to authenticated using (eh_admin_cliente(cliente_id));

create policy contatos_tudo on public.contatos_empresa for all to authenticated
  using (exists (select 1 from empresas e where e.id = empresa_id and eh_membro_cliente(e.cliente_id)))
  with check (exists (select 1 from empresas e where e.id = empresa_id and eh_membro_cliente(e.cliente_id)));

create policy eventos_ver on public.eventos for select to authenticated using (eh_membro_cliente(cliente_id));
create policy eventos_criar on public.eventos for insert to authenticated with check (eh_membro_cliente(cliente_id));
create policy eventos_editar on public.eventos for update to authenticated
  using (eh_membro_cliente(cliente_id)) with check (eh_membro_cliente(cliente_id));
create policy eventos_excluir on public.eventos for delete to authenticated using (eh_admin_cliente(cliente_id));

create policy interacoes_ver on public.interacoes for select to authenticated
  using (exists (select 1 from empresas e where e.id = empresa_id and eh_membro_cliente(e.cliente_id)));
create policy interacoes_criar on public.interacoes for insert to authenticated
  with check (autor_id = auth.uid() and exists (select 1 from empresas e where e.id = empresa_id and eh_membro_cliente(e.cliente_id)));
-- Cada um corrige o que registrou; administrador corrige qualquer registro
create policy interacoes_editar on public.interacoes for update to authenticated
  using (autor_id = auth.uid() or exists (select 1 from empresas e where e.id = empresa_id and eh_admin_cliente(e.cliente_id)));
create policy interacoes_excluir on public.interacoes for delete to authenticated
  using (autor_id = auth.uid() or exists (select 1 from empresas e where e.id = empresa_id and eh_admin_cliente(e.cliente_id)));
