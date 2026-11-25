-- Luminy · foto das empresas parceiras (logo ou fachada)

alter table public.empresas add column foto_url text;

-- Imagens ficam no Storage do Supabase, numa pasta por cliente: <cliente_id>/<empresa_id>-<data>.webp
-- Logo e fachada não são dados sensíveis, então a leitura é pública (precisa do link exato).
-- Só a equipe do cliente envia, troca ou apaga.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('empresas', 'empresas', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
    on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

    execute $p$
      create policy empresas_fotos_enviar on storage.objects for insert to authenticated
        with check (bucket_id = 'empresas' and public.eh_membro_cliente(((storage.foldername(name))[1])::uuid))
    $p$;
    execute $p$
      create policy empresas_fotos_trocar on storage.objects for update to authenticated
        using (bucket_id = 'empresas' and public.eh_membro_cliente(((storage.foldername(name))[1])::uuid))
    $p$;
    execute $p$
      create policy empresas_fotos_apagar on storage.objects for delete to authenticated
        using (bucket_id = 'empresas' and public.eh_membro_cliente(((storage.foldername(name))[1])::uuid))
    $p$;
  end if;
end $$;
