-- Luminy · cards do Kanban no jeito do Trello: capa, legenda, checklist, anexos e comentários

alter table public.cards
  add column legenda text,                               -- texto que vai junto do post
  add column capa_path text,                             -- imagem de capa (armazenamento privado "cards")
  add column capa_cor text check (capa_cor is null or capa_cor ~ '^#[0-9A-Fa-f]{6}$'),
  add column checklist jsonb not null default '[]',      -- [{id, texto, feito}]
  add column anexos jsonb not null default '[]';         -- [{id, tipo: arquivo|link, nome, caminho?, url?, mime?, criado_em}]

create table public.card_comentarios (
  id bigint generated always as identity primary key,
  card_id uuid not null references public.cards (id) on delete cascade,
  autor_id uuid not null default auth.uid() references auth.users (id),
  texto text not null check (length(trim(texto)) > 0),
  criado_em timestamptz not null default now()
);
create index on public.card_comentarios (card_id, criado_em);

alter table public.card_comentarios enable row level security;
create policy comentarios_ver on public.card_comentarios for select to authenticated
  using (exists (select 1 from cards c where c.id = card_id and pode_ver_quadro(c.quadro_id)));
create policy comentarios_criar on public.card_comentarios for insert to authenticated
  with check (autor_id = auth.uid() and exists (select 1 from cards c where c.id = card_id and pode_ver_quadro(c.quadro_id)));
create policy comentarios_apagar on public.card_comentarios for delete to authenticated using (autor_id = auth.uid());

-- Imagens e arquivos dos cards podem mostrar pacientes: armazenamento PRIVADO.
-- Pasta por quadro (<quadro_id>/<card_id>/<arquivo>); só quem vê o quadro abre os arquivos.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('cards', 'cards', false, 26214400)
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

    execute $p$
      create policy cards_arquivos_ver on storage.objects for select to authenticated
        using (bucket_id = 'cards' and public.pode_ver_quadro(((storage.foldername(name))[1])::uuid))
    $p$;
    execute $p$
      create policy cards_arquivos_enviar on storage.objects for insert to authenticated
        with check (bucket_id = 'cards' and public.pode_ver_quadro(((storage.foldername(name))[1])::uuid))
    $p$;
    execute $p$
      create policy cards_arquivos_apagar on storage.objects for delete to authenticated
        using (bucket_id = 'cards' and public.pode_ver_quadro(((storage.foldername(name))[1])::uuid))
    $p$;
  end if;
end $$;
