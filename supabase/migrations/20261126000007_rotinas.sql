-- Luminy · Rotinas: tarefas que se repetem, passadas para pessoas da equipe (ex.: ronda, responder comentários, stories)

create table public.rotinas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  titulo text not null check (length(trim(titulo)) > 0),
  descricao text,
  repeticao text not null default 'semana' check (repeticao in ('semana', 'mes')),
  dias_semana smallint[] not null default '{1,2,3,4,5}',      -- 0 = domingo … 6 = sábado (repetição "semana")
  dia_mes smallint check (dia_mes between 1 and 31),          -- repetição "mes"
  horarios time[] not null default '{}',                      -- vazio = uma vez no dia; vários = uma por horário
  responsaveis uuid[] not null default '{}',                  -- vazio = qualquer pessoa da equipe
  cada_um boolean not null default false,                     -- true: cada responsável faz a sua; false: basta um fazer
  checklist jsonb not null default '[]',                      -- [{id, texto}]
  exige_foto boolean not null default false,
  inicio date not null default current_date,
  ativa boolean not null default true,
  criado_por uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now(),
  constraint rotina_mensal check (repeticao <> 'mes' or dia_mes is not null),
  constraint rotina_dias check (repeticao <> 'semana' or cardinality(dias_semana) > 0)
);

create table public.rotina_registros (
  id uuid primary key default gen_random_uuid(),
  rotina_id uuid not null references public.rotinas (id) on delete cascade,
  data date not null,
  horario time,
  usuario_id uuid not null default auth.uid() references auth.users (id),
  pessoa_chave uuid,                                           -- preenchido sozinho: quem, quando "cada um faz a sua"
  itens jsonb not null default '[]',                           -- itens da checklist marcados
  foto_path text,
  observacao text,
  feito_em timestamptz not null default now()
);
-- Cada ocorrência (dia + horário) só é feita uma vez, ou uma vez por pessoa quando "cada um faz a sua"
create unique index rotina_registro_unico on public.rotina_registros (rotina_id, data, coalesce(horario, '00:00'), pessoa_chave) nulls not distinct;
create index on public.rotina_registros (data);

create or replace function public.tg_rotina_registro()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from rotinas where id = new.rotina_id;
  new.usuario_id := auth.uid();
  new.pessoa_chave := case when r.cada_um then auth.uid() end;
  if r.exige_foto and new.foto_path is null then
    raise exception 'Esta rotina pede uma foto de comprovação' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger rotina_registro before insert on public.rotina_registros for each row execute function public.tg_rotina_registro();

alter table public.rotinas enable row level security;
alter table public.rotina_registros enable row level security;
-- Toda a equipe vê as rotinas; só administradores criam, mudam ou apagam
create policy rotinas_ver on public.rotinas for select to authenticated using (eh_membro_cliente(cliente_id));
create policy rotinas_gerir on public.rotinas for all to authenticated using (eh_admin_cliente(cliente_id)) with check (eh_admin_cliente(cliente_id));
-- Registros: a equipe vê quem fez; só marca quem é responsável (ou qualquer um, se a rotina for aberta)
create policy registros_ver on public.rotina_registros for select to authenticated
  using (exists (select 1 from rotinas r where r.id = rotina_id and eh_membro_cliente(r.cliente_id)));
create policy registros_marcar on public.rotina_registros for insert to authenticated
  with check (exists (select 1 from rotinas r where r.id = rotina_id and r.ativa and eh_membro_cliente(r.cliente_id)
                      and (cardinality(r.responsaveis) = 0 or auth.uid() = any (r.responsaveis) or eh_admin_cliente(r.cliente_id))));
create policy registros_desmarcar on public.rotina_registros for delete to authenticated
  using (usuario_id = auth.uid() and data >= current_date - 1);

-- Fotos de comprovação: armazenamento privado, pasta por cliente
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit) values ('rotinas', 'rotinas', false, 10485760) on conflict (id) do nothing;
    execute $p$ create policy rotinas_fotos_ver on storage.objects for select to authenticated
      using (bucket_id = 'rotinas' and public.eh_membro_cliente(((storage.foldername(name))[1])::uuid)) $p$;
    execute $p$ create policy rotinas_fotos_enviar on storage.objects for insert to authenticated
      with check (bucket_id = 'rotinas' and public.eh_membro_cliente(((storage.foldername(name))[1])::uuid)) $p$;
  end if;
end $$;

-- TV: rotinas concluídas também ganham a comemoração
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
      select jsonb_agg(x order by x->>'em' desc) from (
        select jsonb_build_object('id', f.id, 'nome', split_part(p.nome, ' ', 1), 'titulo', f.titulo, 'em', f.concluido_em) x
          from focos f join perfis p on p.id = f.usuario_id
         where f.cliente_id = v_cliente and f.concluido_em > now() - interval '12 hours'
        union all
        select jsonb_build_object('id', g.id, 'nome', split_part(p.nome, ' ', 1), 'titulo', r.titulo, 'em', g.feito_em)
          from rotina_registros g join rotinas r on r.id = g.rotina_id join perfis p on p.id = g.usuario_id
         where r.cliente_id = v_cliente and g.feito_em > now() - interval '12 hours') t), '[]'::jsonb));
end $$;
