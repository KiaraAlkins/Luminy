-- Luminy · Ordens de serviço (OS) registradas à mão a partir do Tasy do hospital

create type public.situacao_os as enum ('aberta', 'em_andamento', 'aguardando', 'concluida', 'cancelada');

create table public.ordens_servico (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  numero text not null check (length(trim(numero)) > 0),     -- número da OS no Tasy
  titulo text not null check (length(trim(titulo)) > 0),     -- resumo curto para as listas
  descricao text,
  solicitante text,
  contato text,                                              -- ramal, WhatsApp ou e-mail de quem pediu
  setor text,
  local text,
  tipo text,                                                 -- sinalização, placa, adesivo, impressão…
  pedido_em date not null default current_date,
  prazo date,
  prioridade public.prioridade not null default 'comum',
  situacao public.situacao_os not null default 'aberta',
  motivo text,                                               -- por que está aguardando ou foi cancelada
  responsavel_id uuid references auth.users (id),
  fotos jsonb not null default '[]',                         -- [{id, caminho, tipo: local|referencia|resultado, nome, criado_em}]
  links jsonb not null default '[]',                         -- [{id, url, nome}]
  custo numeric check (custo is null or custo >= 0),
  fornecedor text,
  concluida_em timestamptz,
  criado_por uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint os_motivo check (situacao not in ('aguardando', 'cancelada') or length(trim(coalesce(motivo, ''))) > 0)
);
create unique index ordens_servico_numero on public.ordens_servico (cliente_id, lower(trim(numero)));
create index on public.ordens_servico (cliente_id, situacao);

create table public.os_eventos (
  id bigint generated always as identity primary key,
  os_id uuid not null references public.ordens_servico (id) on delete cascade,
  autor_id uuid default auth.uid() references auth.users (id),
  tipo text not null check (tipo in ('comentario', 'situacao', 'criada', 'material')),
  texto text,
  detalhe jsonb not null default '{}',
  criado_em timestamptz not null default now()
);
create index on public.os_eventos (os_id, criado_em);

-- Histórico automático: criação e mudança de situação (com quem mudou)
create or replace function public.tg_os_historico()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into os_eventos (os_id, autor_id, tipo) values (new.id, auth.uid(), 'criada');
    return new;
  end if;
  new.atualizado_em := now();
  if new.situacao is distinct from old.situacao then
    new.concluida_em := case when new.situacao = 'concluida' then now() end;
    if new.situacao not in ('aguardando', 'cancelada') then new.motivo := null; end if;
    insert into os_eventos (os_id, autor_id, tipo, detalhe)
    values (new.id, auth.uid(), 'situacao', jsonb_build_object('de', old.situacao, 'para', new.situacao, 'motivo', new.motivo));
  end if;
  return new;
end $$;
create trigger os_historico_insert after insert on public.ordens_servico for each row execute function public.tg_os_historico();
create trigger os_historico_update before update on public.ordens_servico for each row execute function public.tg_os_historico();

alter table public.ordens_servico enable row level security;
alter table public.os_eventos enable row level security;
create policy os_ver on public.ordens_servico for select to authenticated using (eh_membro_cliente(cliente_id));
create policy os_criar on public.ordens_servico for insert to authenticated with check (eh_membro_cliente(cliente_id) and criado_por = auth.uid());
create policy os_editar on public.ordens_servico for update to authenticated using (eh_membro_cliente(cliente_id)) with check (eh_membro_cliente(cliente_id));
create policy os_excluir on public.ordens_servico for delete to authenticated using (eh_admin_cliente(cliente_id));
create policy os_eventos_ver on public.os_eventos for select to authenticated
  using (exists (select 1 from ordens_servico o where o.id = os_id and eh_membro_cliente(o.cliente_id)));
create policy os_eventos_criar on public.os_eventos for insert to authenticated
  with check (tipo in ('comentario', 'material') and autor_id = auth.uid()
              and exists (select 1 from ordens_servico o where o.id = os_id and eh_membro_cliente(o.cliente_id)));

-- Fotos das OS (local, referência, resultado): armazenamento PRIVADO, pasta por cliente
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('os', 'os', false, 15728640)
    on conflict (id) do update set public = false;
    execute $p$ create policy os_fotos_ver on storage.objects for select to authenticated
      using (bucket_id = 'os' and public.eh_membro_cliente(((storage.foldername(name))[1])::uuid)) $p$;
    execute $p$ create policy os_fotos_enviar on storage.objects for insert to authenticated
      with check (bucket_id = 'os' and public.eh_membro_cliente(((storage.foldername(name))[1])::uuid)) $p$;
    execute $p$ create policy os_fotos_apagar on storage.objects for delete to authenticated
      using (bucket_id = 'os' and public.eh_membro_cliente(((storage.foldername(name))[1])::uuid)) $p$;
  end if;
end $$;
