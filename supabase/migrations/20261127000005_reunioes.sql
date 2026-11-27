-- Luminy · Reuniões (Organização): agenda, pauta, anotações, encaminhamentos e anexos.
-- Reunião restrita: só participantes, quem criou e administradores veem.

create table public.reunioes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  titulo text not null check (length(trim(titulo)) > 0),
  descricao text,                                   -- objetivo da reunião
  inicio timestamptz not null,
  duracao_min smallint not null default 60 check (duracao_min between 5 and 600),
  local text,                                       -- sala, endereço ou link da chamada
  participantes uuid[] not null default '{}',
  convidados text,                                  -- pessoas de fora (só os nomes)
  restrita boolean not null default false,
  recorrencia text not null default 'nenhuma' check (recorrencia in ('nenhuma', 'semanal', 'quinzenal', 'mensal')),
  serie_id uuid,                                    -- reuniões da mesma série (as que se repetem)
  situacao text not null default 'agendada' check (situacao in ('agendada', 'realizada', 'cancelada')),
  pauta jsonb not null default '[]',                -- [{id, texto, autor, discutido}]
  ata text,                                         -- anotações / o que foi decidido
  encaminhamentos jsonb not null default '[]',      -- [{id, texto, responsavel, prazo, feito, feito_em}]
  anexos jsonb not null default '[]',               -- [{id, nome, caminho, mime, tamanho}]
  criado_por uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on public.reunioes (cliente_id, inicio);
create index on public.reunioes using gin (encaminhamentos jsonb_path_ops);

alter table public.reunioes enable row level security;
create policy reunioes_ver on public.reunioes for select to authenticated
  using (eh_membro_cliente(cliente_id) and (not restrita or auth.uid() = any (participantes) or criado_por = auth.uid() or eh_admin_cliente(cliente_id)));
create policy reunioes_criar on public.reunioes for insert to authenticated
  with check (eh_membro_cliente(cliente_id) and criado_por = auth.uid());
create policy reunioes_editar on public.reunioes for update to authenticated
  using (eh_membro_cliente(cliente_id) and (not restrita or auth.uid() = any (participantes) or criado_por = auth.uid() or eh_admin_cliente(cliente_id)))
  with check (eh_membro_cliente(cliente_id));
create policy reunioes_apagar on public.reunioes for delete to authenticated
  using (criado_por = auth.uid() or eh_admin_cliente(cliente_id));

create trigger reuniao_atualizada before update on public.reunioes for each row execute function public.tg_ponto_atualizado();

-- Marca um encaminhamento como feito (ou não) sem reescrever a lista inteira
create or replace function public.marcar_encaminhamento(p_reuniao uuid, p_encaminhamento text, p_feito boolean)
returns void language sql security invoker set search_path = public as $$
  update reunioes set encaminhamentos = (
    select coalesce(jsonb_agg(case when e->>'id' = p_encaminhamento
      then e || jsonb_build_object('feito', p_feito, 'feito_em', case when p_feito then to_jsonb(now()) else 'null'::jsonb end) else e end order by ord), '[]'::jsonb)
    from jsonb_array_elements(encaminhamentos) with ordinality as t(e, ord))
  where id = p_reuniao;
$$;
grant execute on function public.marcar_encaminhamento(uuid, text, boolean) to authenticated;

-- Anexos: armazenamento PRIVADO, pasta <cliente>/<reunião>/; só quem vê a reunião abre os arquivos
create or replace function public.pode_ver_reuniao(p_reuniao uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from reunioes r where r.id = p_reuniao and eh_membro_cliente(r.cliente_id)
    and (not r.restrita or auth.uid() = any (r.participantes) or r.criado_por = auth.uid() or eh_admin_cliente(r.cliente_id)));
$$;
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('reunioes', 'reunioes', false, 26214400)
    on conflict (id) do update set public = false;
    execute $p$ create policy reunioes_arquivos_ver on storage.objects for select to authenticated
      using (bucket_id = 'reunioes' and public.pode_ver_reuniao(((storage.foldername(name))[2])::uuid)) $p$;
    execute $p$ create policy reunioes_arquivos_enviar on storage.objects for insert to authenticated
      with check (bucket_id = 'reunioes' and public.pode_ver_reuniao(((storage.foldername(name))[2])::uuid)) $p$;
    execute $p$ create policy reunioes_arquivos_apagar on storage.objects for delete to authenticated
      using (bucket_id = 'reunioes' and public.pode_ver_reuniao(((storage.foldername(name))[2])::uuid)) $p$;
  end if;
end $$;
