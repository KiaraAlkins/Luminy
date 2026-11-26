-- Luminy · Aprovações: link seguro para a diretoria/cliente aprovar ou pedir ajuste num post, sem precisar de conta

create type public.situacao_aprovacao as enum ('pendente', 'aprovado', 'ajuste', 'substituida');

create table public.aprovacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  situacao public.situacao_aprovacao not null default 'pendente',
  -- O que foi enviado (foto do momento: se o card mudar depois, quem aprova vê o que foi mandado)
  titulo text not null,
  legenda text,
  tipo_conteudo text,
  redes text[] not null default '{}',
  postagem_em timestamptz,
  imagens jsonb not null default '[]',        -- [{url, nome}] links temporários das imagens (privadas) válidos até expirar
  mensagem text,                              -- recado para quem aprova
  aprovador text,                             -- para quem foi enviado (ex.: "Dra. Paula, diretoria")
  -- Resposta
  resposta text,
  respondido_por_nome text,
  respondido_por uuid references auth.users (id),
  respondido_em timestamptz,
  enviado_por uuid not null default auth.uid() references auth.users (id),
  enviado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '14 days'
);
create index on public.aprovacoes (cliente_id, situacao);
create index on public.aprovacoes (card_id);

-- Enviar de novo o mesmo card invalida o link anterior
create or replace function public.tg_aprovacao_nova()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update aprovacoes set situacao = 'substituida' where card_id = new.card_id and situacao = 'pendente' and id <> new.id;
  return new;
end $$;
create trigger aprovacao_nova after insert on public.aprovacoes for each row execute function public.tg_aprovacao_nova();

alter table public.aprovacoes enable row level security;
create policy aprovacoes_ver on public.aprovacoes for select to authenticated using (eh_membro_cliente(cliente_id));
create policy aprovacoes_enviar on public.aprovacoes for insert to authenticated
  with check (eh_membro_cliente(cliente_id) and enviado_por = auth.uid()
              and exists (select 1 from cards c join quadros q on q.id = c.quadro_id where c.id = card_id and q.cliente_id = aprovacoes.cliente_id));
create policy aprovacoes_editar on public.aprovacoes for update to authenticated using (eh_membro_cliente(cliente_id)) with check (eh_membro_cliente(cliente_id));
create policy aprovacoes_excluir on public.aprovacoes for delete to authenticated using (eh_admin_cliente(cliente_id));

-- Aprovado: o card vai para a coluna "Feito e aprovado" (se ainda não foi postado)
create or replace function public.aprovar_card(p_card uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_coluna uuid; v_atual text;
begin
  select co.nome into v_atual from cards c join colunas co on co.id = c.coluna_id where c.id = p_card;
  if v_atual ilike 'postado%' then return; end if;
  select co.id into v_coluna from cards c join colunas co on co.quadro_id = c.quadro_id
   where c.id = p_card and co.nome ilike 'feito%aprovado%' limit 1;
  if v_coluna is not null then
    update cards set coluna_id = v_coluna, motivo_impedimento = null,
           posicao = coalesce((select max(posicao) from cards where coluna_id = v_coluna), 0) + 1
     where id = p_card and coluna_id <> v_coluna;
  end if;
end $$;
revoke all on function public.aprovar_card(uuid) from public, anon, authenticated;

-- Página pública: mostra só o que foi enviado, enquanto o link vale
create or replace function public.ver_aprovacao(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a record;
begin
  select ap.*, cl.nome as cliente_nome, cl.cor as cliente_cor into a
    from aprovacoes ap join clientes cl on cl.id = ap.cliente_id where ap.token = p_token;
  if not found or a.situacao = 'substituida' then return jsonb_build_object('situacao', 'inexistente'); end if;
  if a.situacao = 'pendente' and a.expira_em < now() then return jsonb_build_object('situacao', 'expirada', 'cliente', a.cliente_nome); end if;
  return jsonb_build_object(
    'situacao', a.situacao, 'cliente', a.cliente_nome, 'cor', a.cliente_cor,
    'titulo', a.titulo, 'legenda', a.legenda, 'tipo', a.tipo_conteudo, 'redes', a.redes, 'postagem_em', a.postagem_em,
    'imagens', a.imagens, 'mensagem', a.mensagem, 'aprovador', a.aprovador,
    'resposta', a.resposta, 'respondido_por', a.respondido_por_nome, 'respondido_em', a.respondido_em);
end $$;

create or replace function public.responder_aprovacao(p_token text, p_aprovar boolean, p_nome text, p_comentario text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a record;
begin
  select * into a from aprovacoes where token = p_token for update;
  if not found or a.situacao <> 'pendente' then raise exception 'Este link não está mais aguardando resposta' using errcode = 'check_violation'; end if;
  if a.expira_em < now() then raise exception 'Este link expirou' using errcode = 'check_violation'; end if;
  if length(trim(coalesce(p_nome, ''))) < 2 then raise exception 'Escreva seu nome' using errcode = 'check_violation'; end if;
  if not p_aprovar and length(trim(coalesce(p_comentario, ''))) < 3 then raise exception 'Escreva o que precisa ajustar' using errcode = 'check_violation'; end if;
  update aprovacoes set situacao = case when p_aprovar then 'aprovado'::situacao_aprovacao else 'ajuste' end,
         resposta = nullif(trim(coalesce(p_comentario, '')), ''), respondido_por_nome = left(trim(p_nome), 80),
         respondido_por = auth.uid(), respondido_em = now()
   where id = a.id;
  if p_aprovar then perform aprovar_card(a.card_id); end if;
end $$;

revoke all on function public.ver_aprovacao(text) from public;
revoke all on function public.responder_aprovacao(text, boolean, text, text) from public;
grant execute on function public.ver_aprovacao(text) to anon, authenticated;
grant execute on function public.responder_aprovacao(text, boolean, text, text) to anon, authenticated;
