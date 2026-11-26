-- Luminy · Minhas tarefas e Demandas

-- ---------------------------------------------------------------- tarefas pessoais
alter table public.tarefas
  add column concluida_em timestamptz,
  add column posicao double precision not null default 0;

create or replace function public.tg_tarefa_concluida()
returns trigger language plpgsql as $$
begin
  if new.status = 'concluida' and (tg_op = 'INSERT' or old.status is distinct from 'concluida') then new.concluida_em := now();
  elsif new.status <> 'concluida' then new.concluida_em := null;
  end if;
  return new;
end $$;
create trigger tarefa_concluida before insert or update of status on public.tarefas
  for each row execute function public.tg_tarefa_concluida();

-- ---------------------------------------------------------------- demandas
alter table public.demandas
  add column card_id uuid references public.cards (id) on delete set null,
  add column aceita_em timestamptz,
  add column concluida_em timestamptz,
  add column posicao double precision not null default 0,
  add column atualizado_em timestamptz not null default now();

-- Conversa e histórico da demanda (comentários e mudanças de situação)
create table public.demanda_eventos (
  id bigint generated always as identity primary key,
  demanda_id uuid not null references public.demandas (id) on delete cascade,
  autor_id uuid default auth.uid() references auth.users (id),
  tipo text not null check (tipo in ('comentario', 'situacao', 'criada', 'aceita', 'card')),
  texto text,
  detalhe jsonb not null default '{}',
  criado_em timestamptz not null default now()
);
create index on public.demanda_eventos (demanda_id, criado_em);
alter table public.demanda_eventos enable row level security;
create policy demanda_eventos_ver on public.demanda_eventos for select to authenticated
  using (exists (select 1 from demandas d where d.id = demanda_id and eh_membro_cliente(d.cliente_id)));
create policy demanda_eventos_comentar on public.demanda_eventos for insert to authenticated
  with check (tipo = 'comentario' and autor_id = auth.uid() and length(trim(coalesce(texto, ''))) > 0
              and exists (select 1 from demandas d where d.id = demanda_id and eh_membro_cliente(d.cliente_id)));

create or replace function public.tg_demanda_historico()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into demanda_eventos (demanda_id, autor_id, tipo) values (new.id, auth.uid(), 'criada');
    return new;
  end if;
  new.atualizado_em := now();
  if new.status is distinct from old.status then
    if new.status = 'concluida' then new.concluida_em := now(); else new.concluida_em := null; end if;
    if old.status = 'aguardando_aceite' and new.status not in ('cancelada', 'aguardando_aceite') and new.aceita_em is null then new.aceita_em := now(); end if;
    insert into demanda_eventos (demanda_id, autor_id, tipo, detalhe)
    values (new.id, auth.uid(), 'situacao', jsonb_build_object('de', old.status, 'para', new.status, 'justificativa', new.justificativa));
  end if;
  if new.card_id is not null and old.card_id is null then
    insert into demanda_eventos (demanda_id, autor_id, tipo) values (new.id, auth.uid(), 'card');
  end if;
  return new;
end $$;
create trigger demanda_historico_insert after insert on public.demandas
  for each row execute function public.tg_demanda_historico();
create trigger demanda_historico_update before update on public.demandas
  for each row execute function public.tg_demanda_historico();

-- Quem pediu ainda pode corrigir a demanda enquanto ninguém aceitou
drop policy demandas_editar on public.demandas;
create policy demandas_editar on public.demandas for update to authenticated
  using (eh_admin_cliente(cliente_id) or responsavel_id = auth.uid() or auth.uid() = any (colaboradores)
         or (criado_por = auth.uid() and status = 'aguardando_aceite'))
  with check (eh_membro_cliente(cliente_id));

-- Aceitar: qualquer pessoa da equipe aceita uma demanda sem responsável;
-- se a demanda foi direcionada para alguém, só essa pessoa (ou um administrador) aceita.
create or replace function public.aceitar_demanda(p_demanda uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d record;
begin
  select * into d from demandas where id = p_demanda for update;
  if not found or not eh_membro_cliente(d.cliente_id) then raise exception 'Demanda não encontrada' using errcode = 'insufficient_privilege'; end if;
  if d.status <> 'aguardando_aceite' then raise exception 'Esta demanda já foi aceita' using errcode = 'check_violation'; end if;
  if d.responsavel_id is not null and d.responsavel_id <> auth.uid() and not eh_admin_cliente(d.cliente_id) then
    raise exception 'Esta demanda foi direcionada para outra pessoa' using errcode = 'insufficient_privilege';
  end if;
  update demandas set responsavel_id = coalesce(responsavel_id, auth.uid()), status = 'a_fazer', aceita_em = now() where id = p_demanda;
end $$;
revoke all on function public.aceitar_demanda(uuid) from public, anon;
grant execute on function public.aceitar_demanda(uuid) to authenticated;
