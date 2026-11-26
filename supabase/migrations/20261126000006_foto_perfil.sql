-- Luminy · foto de perfil (aparece nos responsáveis dos cards, demandas e OS)

create or replace function public.minha_sessao()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'usuario', (select jsonb_build_object('id', p.id, 'nome', p.nome, 'foto_url', p.foto_url) from perfis p where p.id = auth.uid()),
    'agencia', (select jsonb_build_object('id', a.id, 'nome', a.nome) from agencias a where a.proprietario_id = auth.uid() limit 1),
    'clientes', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'slug', c.slug, 'cor', c.cor,
               'papel', case when a.proprietario_id = auth.uid() then 'proprietario' else m.papel::text end,
               'acesso_leads', coalesce(a.proprietario_id = auth.uid(), false) or coalesce(m.acesso_leads, false))
             order by c.nome)
      from clientes c join agencias a on a.id = c.agencia_id
      left join membros_cliente m on m.cliente_id = c.id and m.usuario_id = auth.uid()
      where c.excluido_em is null and (a.proprietario_id = auth.uid() or m.usuario_id is not null)), '[]'::jsonb));
$$;

-- Fotos de perfil: leitura pública (só com o link), cada pessoa mexe só na própria pasta (<id da pessoa>/…)
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('perfis', 'perfis', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
    on conflict (id) do nothing;
    execute $p$ create policy perfis_foto_enviar on storage.objects for insert to authenticated
      with check (bucket_id = 'perfis' and (storage.foldername(name))[1] = auth.uid()::text) $p$;
    execute $p$ create policy perfis_foto_apagar on storage.objects for delete to authenticated
      using (bucket_id = 'perfis' and (storage.foldername(name))[1] = auth.uid()::text) $p$;
  end if;
end $$;
