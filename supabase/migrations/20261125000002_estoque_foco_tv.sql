-- Luminy · estoque de materiais, "Fazendo agora" e painel da TV

-- ---------------------------------------------------------------- Estoque
create type public.tipo_movimento as enum ('entrada', 'saida', 'ajuste');

create table public.estoque_itens (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nome text not null,
  categoria text,             -- ex.: Brindes, Papelaria, Saúde, Eletrônicos
  unidade text not null default 'un',
  quantidade numeric not null default 0,
  minimo numeric not null default 0,   -- abaixo disso, aparece o aviso de repor
  local text,
  validade date,              -- fitas de glicemia, luvas e afins
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (cliente_id, nome)
);

create table public.estoque_movimentos (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.estoque_itens (id) on delete cascade,
  tipo public.tipo_movimento not null,
  quantidade numeric not null,
  motivo text,
  evento_id uuid references public.eventos (id) on delete set null,
  autor_id uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now()
);

-- Cada movimento atualiza o saldo. Saída maior que o saldo é recusada.
-- "ajuste" grava a contagem real (inventário): a quantidade passa a ser o valor informado.
create or replace function public.tg_movimento_estoque()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_atual numeric;
begin
  select quantidade into v_atual from estoque_itens where id = new.item_id for update;
  if new.tipo = 'ajuste' then
    if new.quantidade < 0 then raise exception 'Contagem não pode ser negativa' using errcode = 'check_violation'; end if;
    update estoque_itens set quantidade = new.quantidade, atualizado_em = now() where id = new.item_id;
  else
    if new.quantidade <= 0 then raise exception 'Quantidade precisa ser maior que zero' using errcode = 'check_violation'; end if;
    if new.tipo = 'saida' and new.quantidade > v_atual then
      raise exception 'Saldo insuficiente: há % em estoque', v_atual using errcode = 'check_violation';
    end if;
    update estoque_itens
       set quantidade = quantidade + case when new.tipo = 'entrada' then new.quantidade else -new.quantidade end,
           atualizado_em = now()
     where id = new.item_id;
  end if;
  return new;
end $$;
create trigger movimento_estoque before insert on public.estoque_movimentos
  for each row execute function public.tg_movimento_estoque();

-- A quantidade só muda por movimentos (fica tudo registrado)
create or replace function public.tg_item_sem_saldo_direto()
returns trigger language plpgsql as $$
begin
  -- profundidade 1 = alteração direta; vinda do trigger de movimento é 2
  if new.quantidade is distinct from old.quantidade and pg_trigger_depth() = 1 then
    raise exception 'Use uma entrada, saída ou ajuste para mudar a quantidade' using errcode = 'check_violation';
  end if;
  new.atualizado_em := now();
  return new;
end $$;
create trigger item_sem_saldo_direto before update on public.estoque_itens
  for each row execute function public.tg_item_sem_saldo_direto();

alter table public.estoque_itens enable row level security;
alter table public.estoque_movimentos enable row level security;
create policy estoque_ver on public.estoque_itens for select to authenticated using (eh_membro_cliente(cliente_id));
create policy estoque_criar on public.estoque_itens for insert to authenticated with check (eh_membro_cliente(cliente_id));
create policy estoque_editar on public.estoque_itens for update to authenticated using (eh_membro_cliente(cliente_id)) with check (eh_membro_cliente(cliente_id));
create policy estoque_excluir on public.estoque_itens for delete to authenticated using (eh_admin_cliente(cliente_id));
create policy movimentos_ver on public.estoque_movimentos for select to authenticated
  using (exists (select 1 from estoque_itens i where i.id = item_id and eh_membro_cliente(i.cliente_id)));
create policy movimentos_criar on public.estoque_movimentos for insert to authenticated
  with check (autor_id = auth.uid() and exists (select 1 from estoque_itens i where i.id = item_id and eh_membro_cliente(i.cliente_id)));

-- ---------------------------------------------------------------- "Fazendo agora"
-- Tarefas pessoais continuam privadas. O foco é o que a PRÓPRIA pessoa escolhe mostrar à equipe
-- (e à TV): um card do Kanban, uma demanda ou um texto livre.
create table public.focos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null,
  card_id uuid references public.cards (id) on delete set null,
  iniciado_em timestamptz not null default now(),
  concluido_em timestamptz,
  trocado_em timestamptz
);
create unique index focos_um_ativo on public.focos (cliente_id, usuario_id) where concluido_em is null and trocado_em is null;
create index on public.focos (cliente_id, concluido_em desc);

alter table public.focos enable row level security;
create policy focos_ver on public.focos for select to authenticated using (eh_membro_cliente(cliente_id));
create policy focos_proprio on public.focos for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid() and eh_membro_cliente(cliente_id));

create or replace function public.definir_foco(p_cliente uuid, p_titulo text, p_card uuid default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  update focos set trocado_em = now()
   where cliente_id = p_cliente and usuario_id = auth.uid() and concluido_em is null and trocado_em is null;
  insert into focos (cliente_id, titulo, card_id) values (p_cliente, trim(p_titulo), p_card) returning id into v_id;
  return v_id;
end $$;

create or replace function public.concluir_foco(p_foco uuid)
returns void language sql security invoker set search_path = public as $$
  update focos set concluido_em = now() where id = p_foco and usuario_id = auth.uid() and concluido_em is null;
$$;

-- ---------------------------------------------------------------- Painel da TV
-- Link secreto por cliente, aberto sem login. Mostra só o primeiro nome e o "Fazendo agora".
create table public.paineis_tv (
  cliente_id uuid primary key references public.clientes (id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  criado_por uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now()
);
alter table public.paineis_tv enable row level security;
create policy tv_admin on public.paineis_tv for all to authenticated
  using (eh_admin_cliente(cliente_id)) with check (eh_admin_cliente(cliente_id));

create or replace function public.painel_tv(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_cliente uuid; v_nome text; v_cor text;
begin
  select t.cliente_id, c.nome, c.cor into v_cliente, v_nome, v_cor
    from paineis_tv t join clientes c on c.id = t.cliente_id where t.token = p_token;
  if v_cliente is null then return null; end if;
  return jsonb_build_object(
    'cliente', v_nome, 'cor', v_cor, 'agora', now(),
    'pessoas', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nome', split_part(p.nome, ' ', 1),
               'titulo', f.titulo, 'desde', f.iniciado_em) order by f.iniciado_em nulls last, p.nome)
      from (select usuario_id from membros_cliente where cliente_id = v_cliente
            union select a.proprietario_id from clientes c join agencias a on a.id = c.agencia_id where c.id = v_cliente) m
      join perfis p on p.id = m.usuario_id
      left join focos f on f.usuario_id = m.usuario_id and f.cliente_id = v_cliente and f.concluido_em is null and f.trocado_em is null), '[]'::jsonb),
    'concluidos', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'nome', split_part(p.nome, ' ', 1), 'titulo', f.titulo, 'em', f.concluido_em) order by f.concluido_em desc)
      from focos f join perfis p on p.id = f.usuario_id
      where f.cliente_id = v_cliente and f.concluido_em > now() - interval '12 hours'), '[]'::jsonb));
end $$;

revoke all on function public.painel_tv(text) from public;
grant execute on function public.painel_tv(text) to anon, authenticated;
revoke all on function public.definir_foco(uuid, text, uuid) from public, anon;
revoke all on function public.concluir_foco(uuid) from public, anon;
grant execute on function public.definir_foco(uuid, text, uuid) to authenticated;
grant execute on function public.concluir_foco(uuid) to authenticated;
