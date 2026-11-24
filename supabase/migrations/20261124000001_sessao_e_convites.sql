-- Luminy · login, primeiro acesso e equipe

-- Perfil criado automaticamente quando alguém se cadastra
create or replace function public.tg_novo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists novo_usuario on auth.users;
create trigger novo_usuario after insert on auth.users
  for each row execute function public.tg_novo_usuario();

-- Primeiro acesso: cria a agência do usuário (uma por pessoa).
-- Hoje só o Dilan usa; no futuro, é o ponto de entrada de outras agências.
create or replace function public.iniciar_agencia(p_nome text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'É preciso estar logado'; end if;
  select id into v_id from agencias where proprietario_id = auth.uid();
  if v_id is not null then return v_id; end if;
  insert into agencias (nome, proprietario_id) values (coalesce(nullif(trim(p_nome), ''), 'Minha agência'), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Cria um cliente já com o quadro oficial de redes sociais
create or replace function public.criar_cliente(p_agencia uuid, p_nome text, p_cor text default '#3D2EF9')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_slug text;
begin
  if not eh_proprietario_agencia(p_agencia) then raise exception 'Só o proprietário cria clientes'; end if;
  v_slug := trim(both '-' from regexp_replace(lower(translate(p_nome,
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')), '[^a-z0-9]+', '-', 'g'));
  insert into clientes (agencia_id, nome, slug, cor) values (p_agencia, p_nome, v_slug, coalesce(p_cor, '#3D2EF9')) returning id into v_id;
  perform criar_quadro_redes_sociais(v_id);
  return v_id;
end $$;

-- Adiciona alguém a um cliente pelo e-mail. A pessoa precisa ter conta (convite enviado antes).
create or replace function public.adicionar_membro(p_cliente uuid, p_email text, p_papel public.papel_cliente default 'membro', p_acesso_leads boolean default true)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare v_usuario uuid;
begin
  if not eh_admin_cliente(p_cliente) then raise exception 'Só administradores adicionam pessoas'; end if;
  select id into v_usuario from auth.users where lower(email) = lower(trim(p_email));
  if v_usuario is null then raise exception 'Nenhuma conta com este e-mail. Envie o convite primeiro.'; end if;
  insert into membros_cliente (cliente_id, usuario_id, papel, acesso_leads)
  values (p_cliente, v_usuario, p_papel, p_acesso_leads)
  on conflict (cliente_id, usuario_id) do update set papel = excluded.papel, acesso_leads = excluded.acesso_leads;
  return v_usuario;
end $$;

-- Tudo que a tela precisa saber sobre quem está logado, numa chamada só.
create or replace function public.minha_sessao()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'usuario', (select jsonb_build_object('id', p.id, 'nome', p.nome) from perfis p where p.id = auth.uid()),
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

revoke all on function public.iniciar_agencia(text) from public, anon;
revoke all on function public.criar_cliente(uuid, text, text) from public, anon;
revoke all on function public.adicionar_membro(uuid, text, public.papel_cliente, boolean) from public, anon;
revoke all on function public.minha_sessao() from public, anon;
grant execute on function public.iniciar_agencia(text) to authenticated;
grant execute on function public.criar_cliente(uuid, text, text) to authenticated;
grant execute on function public.adicionar_membro(uuid, text, public.papel_cliente, boolean) to authenticated;
grant execute on function public.minha_sessao() to authenticated;
