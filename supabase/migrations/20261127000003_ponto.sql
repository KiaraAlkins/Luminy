-- Luminy · Ponto (Organização): entrada, almoço e saída de cada pessoa, banco de horas por ciclo,
-- pontos esquecidos e justificativas (com foto). Usar é opcional. Cada um vê o seu; administradores veem todos.

create table public.ponto_config (
  cliente_id uuid primary key references public.clientes (id) on delete cascade,
  entrada time not null default '08:00',
  saida time not null default '18:00',          -- segunda a quinta
  saida_sexta time not null default '17:00',
  almoco_min smallint not null default 60 check (almoco_min between 0 and 240),
  tolerancia_min smallint not null default 15 check (tolerancia_min between 0 and 120),
  ciclo_meses smallint not null default 3 check (ciclo_meses between 1 and 12),
  ciclo_inicio date not null default '2026-01-01',  -- o banco de horas zera a cada ciclo contado a partir daqui
  atualizado_em timestamptz not null default now()
);
alter table public.ponto_config enable row level security;
create policy ponto_config_ver on public.ponto_config for select to authenticated using (eh_membro_cliente(cliente_id));
create policy ponto_config_gerir on public.ponto_config for all to authenticated using (eh_admin_cliente(cliente_id)) with check (eh_admin_cliente(cliente_id));

create table public.pontos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dia date not null,
  entrada time,
  almoco_saida time,
  almoco_volta time,
  saida time,
  esquecidos text[] not null default '{}' check (esquecidos <@ array['entrada', 'almoco_saida', 'almoco_volta', 'saida']),
  justificativa text,
  foto_path text,
  origem text not null default 'app' check (origem in ('app', 'manual', 'planilha')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (cliente_id, usuario_id, dia)
);
create index on public.pontos (cliente_id, dia);
alter table public.pontos enable row level security;
-- Cada um vê e mexe no seu; administradores do cliente veem o de todos (só leitura)
create policy pontos_ver on public.pontos for select to authenticated
  using (eh_membro_cliente(cliente_id) and (usuario_id = auth.uid() or eh_admin_cliente(cliente_id)));
create policy pontos_registrar on public.pontos for insert to authenticated with check (usuario_id = auth.uid() and eh_membro_cliente(cliente_id));
create policy pontos_editar on public.pontos for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid() and eh_membro_cliente(cliente_id));
create policy pontos_apagar on public.pontos for delete to authenticated using (usuario_id = auth.uid());

create or replace function public.tg_ponto_atualizado() returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;
create trigger ponto_atualizado before update on public.pontos for each row execute function public.tg_ponto_atualizado();

-- Fotos das justificativas: armazenamento PRIVADO, pasta <cliente>/<pessoa>/
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('ponto', 'ponto', false, 10485760)
    on conflict (id) do update set public = false;
    execute $p$ create policy ponto_fotos_ver on storage.objects for select to authenticated
      using (bucket_id = 'ponto' and public.eh_membro_cliente(((storage.foldername(name))[1])::uuid)
             and ((storage.foldername(name))[2] = auth.uid()::text or public.eh_admin_cliente(((storage.foldername(name))[1])::uuid))) $p$;
    execute $p$ create policy ponto_fotos_enviar on storage.objects for insert to authenticated
      with check (bucket_id = 'ponto' and public.eh_membro_cliente(((storage.foldername(name))[1])::uuid) and (storage.foldername(name))[2] = auth.uid()::text) $p$;
    execute $p$ create policy ponto_fotos_apagar on storage.objects for delete to authenticated
      using (bucket_id = 'ponto' and (storage.foldername(name))[2] = auth.uid()::text) $p$;
  end if;
end $$;
