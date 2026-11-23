-- Luminy · base do banco
-- Agência > clientes > membros. Todo dado de trabalho pertence a um cliente,
-- e todo cliente pertence a uma agência. Isso deixa a base pronta para, no futuro,
-- atender várias agências sem refazer o modelo.
--
-- Regras de acesso ficam no banco (RLS). A tela só reflete o que o banco permite.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.papel_cliente as enum ('admin', 'membro');
create type public.situacao_cliente as enum ('ativo', 'pausado', 'encerrado');
create type public.prioridade as enum ('alta', 'comum', 'baixa');
create type public.status_tarefa as enum ('a_fazer', 'em_andamento', 'concluida', 'cancelada', 'impedida');
create type public.status_demanda as enum ('aguardando_aceite', 'a_fazer', 'em_andamento', 'concluida', 'cancelada', 'impedida');
create type public.tipo_quadro as enum ('oficial', 'pessoal');

-- ---------------------------------------------------------------------------
-- Pessoas, agência e clientes
-- ---------------------------------------------------------------------------
create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  foto_url text,
  fuso_horario text not null default 'America/Sao_Paulo',
  criado_em timestamptz not null default now()
);

create table public.agencias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  proprietario_id uuid not null references auth.users (id),
  criado_em timestamptz not null default now()
);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  nome text not null,
  slug text not null,
  situacao public.situacao_cliente not null default 'ativo',
  cor text not null default '#3D2EF9',
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  unique (agencia_id, slug)
);

create table public.membros_cliente (
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  papel public.papel_cliente not null default 'membro',
  -- Jovens aprendizes entram com false: não veem leads nem campanhas QR.
  acesso_leads boolean not null default true,
  criado_em timestamptz not null default now(),
  primary key (cliente_id, usuario_id)
);

-- ---------------------------------------------------------------------------
-- Funções de acesso (security definer para não cair em recursão de RLS)
-- ---------------------------------------------------------------------------
create or replace function public.eh_proprietario_agencia(p_agencia uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from agencias a where a.id = p_agencia and a.proprietario_id = auth.uid());
$$;

create or replace function public.eh_membro_cliente(p_cliente uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros_cliente m where m.cliente_id = p_cliente and m.usuario_id = auth.uid())
      or exists (select 1 from clientes c join agencias a on a.id = c.agencia_id
                 where c.id = p_cliente and a.proprietario_id = auth.uid());
$$;

create or replace function public.eh_admin_cliente(p_cliente uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros_cliente m where m.cliente_id = p_cliente and m.usuario_id = auth.uid() and m.papel = 'admin')
      or exists (select 1 from clientes c join agencias a on a.id = c.agencia_id
                 where c.id = p_cliente and a.proprietario_id = auth.uid());
$$;

create or replace function public.pode_ver_leads(p_cliente uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros_cliente m where m.cliente_id = p_cliente and m.usuario_id = auth.uid() and m.acesso_leads)
      or exists (select 1 from clientes c join agencias a on a.id = c.agencia_id
                 where c.id = p_cliente and a.proprietario_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Tarefas pessoais: privadas, nem administrador vê
-- ---------------------------------------------------------------------------
create table public.tarefas (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null,
  descricao text,
  prazo timestamptz,
  prioridade public.prioridade not null default 'comum',
  status public.status_tarefa not null default 'a_fazer',
  justificativa text,
  recorrencia jsonb,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Demandas da equipe
-- ---------------------------------------------------------------------------
create table public.demandas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  titulo text not null,
  descricao text,
  criado_por uuid not null default auth.uid() references auth.users (id),
  responsavel_id uuid references auth.users (id),
  colaboradores uuid[] not null default '{}',
  status public.status_demanda not null default 'aguardando_aceite',
  prioridade public.prioridade not null default 'comum',
  categoria text,
  setor_solicitante text,
  origem text,
  prazo timestamptz,
  justificativa text,
  criado_em timestamptz not null default now(),
  -- Cancelar, recusar ou não concluir exige justificativa (documento v1.1, 3.4)
  constraint demanda_justificativa check (status not in ('cancelada', 'impedida') or coalesce(trim(justificativa), '') <> '')
);

-- ---------------------------------------------------------------------------
-- Kanban
-- ---------------------------------------------------------------------------
create table public.quadros (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_quadro not null,
  cliente_id uuid references public.clientes (id) on delete cascade,
  dono_id uuid references auth.users (id) on delete cascade,
  nome text not null,
  criado_em timestamptz not null default now(),
  constraint quadro_dono check ((tipo = 'oficial' and cliente_id is not null and dono_id is null)
                             or (tipo = 'pessoal' and dono_id is not null and cliente_id is null))
);

create table public.colunas (
  id uuid primary key default gen_random_uuid(),
  quadro_id uuid not null references public.quadros (id) on delete cascade,
  nome text not null,
  posicao int not null,
  exige_motivo boolean not null default false
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  quadro_id uuid not null references public.quadros (id) on delete cascade,
  coluna_id uuid not null references public.colunas (id),
  titulo text not null,
  briefing text,
  tipo_conteudo text,
  redes text[] not null default '{}',
  entrega_em timestamptz,
  postagem_em timestamptz,
  prioridade public.prioridade not null default 'comum',
  responsavel_id uuid references auth.users (id),
  posicao int not null default 0,
  motivo_impedimento text,
  coluna_antes_impedimento uuid references public.colunas (id),
  criado_em timestamptz not null default now()
);

create or replace function public.pode_ver_quadro(p_quadro uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from quadros q where q.id = p_quadro and (
    (q.tipo = 'pessoal' and q.dono_id = auth.uid()) or
    (q.tipo = 'oficial' and eh_membro_cliente(q.cliente_id))));
$$;

-- Mover para Impedimento exige motivo e guarda a coluna de origem (v1.1, 4.3)
create or replace function public.tg_card_impedimento()
returns trigger language plpgsql as $$
declare v_exige boolean;
begin
  select exige_motivo into v_exige from colunas where id = new.coluna_id;
  if v_exige then
    if coalesce(trim(new.motivo_impedimento), '') = '' then
      raise exception 'Mover para Impedimento exige motivo' using errcode = 'check_violation';
    end if;
    if tg_op = 'UPDATE' and old.coluna_id <> new.coluna_id then
      new.coluna_antes_impedimento := old.coluna_id;
    end if;
  else
    new.motivo_impedimento := null;
    new.coluna_antes_impedimento := null;
  end if;
  return new;
end $$;

create trigger card_impedimento before insert or update of coluna_id, motivo_impedimento on public.cards
  for each row execute function public.tg_card_impedimento();

-- Quadro oficial de redes sociais nasce com as colunas do documento (v1.1, 4.2)
create or replace function public.criar_quadro_redes_sociais(p_cliente uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_quadro uuid;
begin
  if not eh_admin_cliente(p_cliente) then raise exception 'Somente administradores criam quadros oficiais'; end if;
  insert into quadros (tipo, cliente_id, nome) values ('oficial', p_cliente, 'Redes sociais') returning id into v_quadro;
  insert into colunas (quadro_id, nome, posicao, exige_motivo) values
    (v_quadro, 'Backlog (ideias)', 1, false),
    (v_quadro, 'Briefing aprovado', 2, false),
    (v_quadro, 'Fazendo', 3, false),
    (v_quadro, 'Feito e aprovado', 4, false),
    (v_quadro, 'Postado e feito', 5, false),
    (v_quadro, 'Impedimento', 6, true);
  return v_quadro;
end $$;

-- ---------------------------------------------------------------------------
-- Campanhas QR e leads
-- ---------------------------------------------------------------------------
create type public.situacao_campanha as enum ('rascunho', 'ativa', 'encerrada');
create type public.etapa_lead as enum ('novo', 'em_contato', 'agendado', 'convertido', 'perdido');

create table public.campanhas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nome text not null,
  inicio date,
  fim date,
  situacao public.situacao_campanha not null default 'rascunho',
  -- Lista de campos: [{chave, rotulo, tipo, modo: 'obrigatorio'|'exibir'|'oculto', valor_fixo, opcoes, segmento}]
  formulario jsonb not null default '[]',
  titulo_publico text,
  texto_publico text,
  mensagem_obrigado text not null default 'Obrigado! Nossa equipe vai entrar em contato.',
  botao_whatsapp text,
  criado_por uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now()
);

create table public.pecas_qr (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.campanhas (id) on delete cascade,
  nome text not null,
  slug text not null unique,
  leituras int not null default 0,
  criado_em timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  campanha_id uuid references public.campanhas (id) on delete set null,
  peca_id uuid references public.pecas_qr (id) on delete set null,
  nome text not null,
  whatsapp text,
  email text,
  dados jsonb not null default '{}',
  segmentos text[] not null default '{}',
  etapa public.etapa_lead not null default 'novo',
  motivo_perda text,
  proxima_acao text,
  proxima_acao_em timestamptz,
  aceite_contato_em timestamptz not null,
  aceite_campanhas_em timestamptz,
  descadastrado_em timestamptz,
  criado_em timestamptz not null default now(),
  constraint lead_perdido check (etapa <> 'perdido' or coalesce(trim(motivo_perda), '') <> '')
);

create table public.eventos_lead (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.leads (id) on delete cascade,
  autor_id uuid references auth.users (id),
  tipo text not null,
  detalhe jsonb not null default '{}',
  criado_em timestamptz not null default now()
);

create index on public.leads (cliente_id, etapa);
create index on public.leads using gin (segmentos);
create index on public.eventos_lead (lead_id, criado_em);

-- Formulário público: devolve só o que o público pode ver.
-- Campos ocultos e seus valores fixos NUNCA saem daqui.
create or replace function public.formulario_publico(p_slug text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select c.id, c.nome, c.situacao, c.inicio, c.fim, c.titulo_publico, c.texto_publico, c.formulario,
         cl.nome as cliente_nome, cl.cor as cliente_cor, p.id as peca_id
    into r
    from pecas_qr p join campanhas c on c.id = p.campanha_id join clientes cl on cl.id = c.cliente_id
   where p.slug = p_slug;
  if not found then return jsonb_build_object('situacao', 'inexistente'); end if;
  update pecas_qr set leituras = leituras + 1 where id = r.peca_id;
  if r.situacao <> 'ativa' or (r.fim is not null and r.fim < current_date) or (r.inicio is not null and r.inicio > current_date) then
    return jsonb_build_object('situacao', 'encerrada', 'cliente', r.cliente_nome);
  end if;
  return jsonb_build_object(
    'situacao', 'ativa',
    'cliente', r.cliente_nome,
    'cor', r.cliente_cor,
    'titulo', coalesce(r.titulo_publico, r.nome),
    'texto', r.texto_publico,
    'campos', coalesce((select jsonb_agg(f - 'valor_fixo' - 'segmento') from jsonb_array_elements(r.formulario) f
                        where f->>'modo' <> 'oculto'), '[]'::jsonb));
end $$;

-- Envio do formulário público (anônimo).
-- Aplica valores fixos dos campos ocultos, ignorando o que vier do navegador.
create or replace function public.enviar_lead(p_slug text, p_respostas jsonb, p_aceite_contato boolean, p_aceite_campanhas boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r record; f jsonb; v_dados jsonb := '{}'; v_segmentos text[] := '{}'; v_valor text; v_lead uuid;
begin
  if not coalesce(p_aceite_contato, false) then
    raise exception 'É preciso aceitar o contato para enviar' using errcode = 'check_violation';
  end if;
  select c.*, p.id as peca_id into r
    from pecas_qr p join campanhas c on c.id = p.campanha_id where p.slug = p_slug;
  if not found or r.situacao <> 'ativa' or (r.fim is not null and r.fim < current_date) then
    raise exception 'Campanha encerrada' using errcode = 'check_violation';
  end if;

  for f in select * from jsonb_array_elements(r.formulario) loop
    if f->>'modo' = 'oculto' then
      v_valor := f->>'valor_fixo';
    else
      v_valor := nullif(trim(p_respostas->>(f->>'chave')), '');
      if f->>'modo' = 'obrigatorio' and v_valor is null then
        raise exception 'Campo obrigatório: %', f->>'rotulo' using errcode = 'check_violation';
      end if;
    end if;
    if v_valor is not null then
      v_dados := v_dados || jsonb_build_object(f->>'chave', v_valor);
      -- Campo marcado como segmento: resposta "sim" vira etiqueta do lead (ex.: risco de diabetes)
      if f ? 'segmento' and lower(v_valor) in ('sim', 'true') then
        v_segmentos := v_segmentos || (f->>'segmento');
      end if;
    end if;
  end loop;

  insert into leads (cliente_id, campanha_id, peca_id, nome, whatsapp, email, dados, segmentos,
                     aceite_contato_em, aceite_campanhas_em)
  values (r.cliente_id, r.id, r.peca_id,
          coalesce(v_dados->>'nome', 'Sem nome'), v_dados->>'whatsapp', v_dados->>'email',
          v_dados - 'nome' - 'whatsapp' - 'email', v_segmentos,
          now(), case when p_aceite_campanhas then now() end)
  returning id into v_lead;
  insert into eventos_lead (lead_id, tipo, detalhe) values (v_lead, 'criado', jsonb_build_object('peca', r.peca_id));
  return v_lead;
end $$;

-- Abrir um lead registra o acesso (sigilo, v2.0 seção 8)
create or replace function public.abrir_lead(p_lead uuid)
returns setof public.leads language plpgsql security definer set search_path = public as $$
declare v_cliente uuid;
begin
  select cliente_id into v_cliente from leads where id = p_lead;
  if v_cliente is null or not pode_ver_leads(v_cliente) then raise exception 'Sem acesso a este lead'; end if;
  insert into eventos_lead (lead_id, autor_id, tipo) values (p_lead, auth.uid(), 'aberto');
  return query select * from leads where id = p_lead;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.perfis enable row level security;
alter table public.agencias enable row level security;
alter table public.clientes enable row level security;
alter table public.membros_cliente enable row level security;
alter table public.tarefas enable row level security;
alter table public.demandas enable row level security;
alter table public.quadros enable row level security;
alter table public.colunas enable row level security;
alter table public.cards enable row level security;
alter table public.campanhas enable row level security;
alter table public.pecas_qr enable row level security;
alter table public.leads enable row level security;
alter table public.eventos_lead enable row level security;

-- Perfis: cada um edita o seu; vê o de quem divide algum cliente
create policy perfis_ver on public.perfis for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from membros_cliente a join membros_cliente b on a.cliente_id = b.cliente_id
    where a.usuario_id = auth.uid() and b.usuario_id = perfis.id));
create policy perfis_editar on public.perfis for update to authenticated using (id = auth.uid());
create policy perfis_criar on public.perfis for insert to authenticated with check (id = auth.uid());

create policy agencias_ver on public.agencias for select to authenticated using (proprietario_id = auth.uid());
create policy agencias_criar on public.agencias for insert to authenticated with check (proprietario_id = auth.uid());

create policy clientes_ver on public.clientes for select to authenticated using (eh_membro_cliente(id) and excluido_em is null);
create policy clientes_gerir on public.clientes for all to authenticated
  using (eh_proprietario_agencia(agencia_id)) with check (eh_proprietario_agencia(agencia_id));

create policy membros_ver on public.membros_cliente for select to authenticated using (eh_membro_cliente(cliente_id));
create policy membros_gerir on public.membros_cliente for all to authenticated
  using (eh_admin_cliente(cliente_id)) with check (eh_admin_cliente(cliente_id));

create policy tarefas_dono on public.tarefas for all to authenticated
  using (dono_id = auth.uid()) with check (dono_id = auth.uid());

create policy demandas_ver on public.demandas for select to authenticated using (eh_membro_cliente(cliente_id));
create policy demandas_criar on public.demandas for insert to authenticated
  with check (eh_membro_cliente(cliente_id) and criado_por = auth.uid());
create policy demandas_editar on public.demandas for update to authenticated
  using (eh_admin_cliente(cliente_id) or responsavel_id = auth.uid() or auth.uid() = any (colaboradores));
create policy demandas_excluir on public.demandas for delete to authenticated using (eh_admin_cliente(cliente_id));

create policy quadros_ver on public.quadros for select to authenticated using (pode_ver_quadro(id));
create policy quadros_pessoal on public.quadros for all to authenticated
  using (tipo = 'pessoal' and dono_id = auth.uid()) with check (tipo = 'pessoal' and dono_id = auth.uid());
create policy quadros_oficial on public.quadros for all to authenticated
  using (tipo = 'oficial' and eh_admin_cliente(cliente_id)) with check (tipo = 'oficial' and eh_admin_cliente(cliente_id));

create policy colunas_ver on public.colunas for select to authenticated using (pode_ver_quadro(quadro_id));
create policy colunas_gerir on public.colunas for all to authenticated using (
  exists (select 1 from quadros q where q.id = quadro_id and (
    (q.tipo = 'pessoal' and q.dono_id = auth.uid()) or (q.tipo = 'oficial' and eh_admin_cliente(q.cliente_id)))));

-- Todos os membros criam, editam e movem cards (v1.1, 4.3)
create policy cards_tudo on public.cards for all to authenticated
  using (pode_ver_quadro(quadro_id)) with check (pode_ver_quadro(quadro_id));

create policy campanhas_ver on public.campanhas for select to authenticated using (pode_ver_leads(cliente_id));
create policy campanhas_gerir on public.campanhas for all to authenticated
  using (pode_ver_leads(cliente_id)) with check (pode_ver_leads(cliente_id));
create policy pecas_ver on public.pecas_qr for all to authenticated using (
  exists (select 1 from campanhas c where c.id = campanha_id and pode_ver_leads(c.cliente_id)));

-- Leads: só quem tem acesso a leads. Nenhuma inserção direta: só pelo formulário.
create policy leads_ver on public.leads for select to authenticated using (pode_ver_leads(cliente_id));
create policy leads_editar on public.leads for update to authenticated
  using (pode_ver_leads(cliente_id)) with check (pode_ver_leads(cliente_id));
create policy leads_excluir on public.leads for delete to authenticated using (eh_admin_cliente(cliente_id));

create policy eventos_ver on public.eventos_lead for select to authenticated using (
  exists (select 1 from leads l where l.id = lead_id and pode_ver_leads(l.cliente_id)));
create policy eventos_criar on public.eventos_lead for insert to authenticated with check (
  autor_id = auth.uid() and exists (select 1 from leads l where l.id = lead_id and pode_ver_leads(l.cliente_id)));

-- Funções públicas do formulário: liberadas para visitantes anônimos
revoke all on function public.formulario_publico(text) from public;
revoke all on function public.enviar_lead(text, jsonb, boolean, boolean) from public;
grant execute on function public.formulario_publico(text) to anon, authenticated;
grant execute on function public.enviar_lead(text, jsonb, boolean, boolean) to anon, authenticated;
revoke all on function public.abrir_lead(uuid) from public;
grant execute on function public.abrir_lead(uuid) to authenticated;
