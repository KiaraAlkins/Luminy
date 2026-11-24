-- Luminy · convites de equipe
-- Criar conta leva a pessoa para o próprio espaço no Luminy (como na Orkestrya).
-- Entrar na equipe de um cliente só acontece por convite: link (WhatsApp) ou e-mail.

create table public.convites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  email text,  -- opcional: sem e-mail, vale para quem abrir o link primeiro
  papel public.papel_cliente not null default 'membro',
  acesso_leads boolean not null default true,
  criado_por uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '7 days',
  aceito_por uuid references auth.users (id),
  aceito_em timestamptz
);

alter table public.convites enable row level security;
create policy convites_admin on public.convites for all to authenticated
  using (eh_admin_cliente(cliente_id)) with check (eh_admin_cliente(cliente_id) and criado_por = auth.uid());

-- Aceitar um convite pelo link
create or replace function public.aceitar_convite(p_token text)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare c record; v_email text;
begin
  if auth.uid() is null then raise exception 'É preciso estar logado'; end if;
  select * into c from convites where token = p_token;
  if not found then raise exception 'Convite não encontrado'; end if;
  if c.aceito_em is not null and c.aceito_por <> auth.uid() then raise exception 'Este convite já foi usado'; end if;
  if c.expira_em < now() then raise exception 'Este convite expirou'; end if;
  select email into v_email from auth.users where id = auth.uid();
  if c.email is not null and lower(c.email) <> lower(v_email) then
    raise exception 'Este convite foi enviado para outro e-mail';
  end if;
  insert into membros_cliente (cliente_id, usuario_id, papel, acesso_leads)
  values (c.cliente_id, auth.uid(), c.papel, c.acesso_leads)
  on conflict (cliente_id, usuario_id) do update set papel = excluded.papel, acesso_leads = excluded.acesso_leads;
  update convites set aceito_por = auth.uid(), aceito_em = now() where id = c.id;
  return jsonb_build_object('cliente_id', c.cliente_id, 'cliente', (select nome from clientes where id = c.cliente_id));
end $$;

-- Mostra o convite antes de aceitar (nome do cliente e de quem convidou), sem expor mais nada
create or replace function public.ver_convite(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('cliente', cl.nome, 'convidado_por', p.nome, 'expirado', c.expira_em < now(),
                            'usado', c.aceito_em is not null, 'email', c.email)
  from convites c join clientes cl on cl.id = c.cliente_id left join perfis p on p.id = c.criado_por
  where c.token = p_token;
$$;

-- Convites por e-mail são aceitos sozinhos quando a pessoa cria a conta com aquele e-mail
create or replace function public.tg_aceitar_convites_por_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into membros_cliente (cliente_id, usuario_id, papel, acesso_leads)
  select c.cliente_id, new.id, c.papel, c.acesso_leads from convites c
   where c.email is not null and lower(c.email) = lower(new.email) and c.aceito_em is null and c.expira_em >= now()
  on conflict (cliente_id, usuario_id) do nothing;
  update convites set aceito_por = new.id, aceito_em = now()
   where email is not null and lower(email) = lower(new.email) and aceito_em is null and expira_em >= now();
  return new;
end $$;

drop trigger if exists aceitar_convites_por_email on auth.users;
create trigger aceitar_convites_por_email after insert on auth.users
  for each row execute function public.tg_aceitar_convites_por_email();

-- Equipe do cliente (nomes e permissões), para a tela de configurações
create or replace function public.equipe_cliente(p_cliente uuid)
returns table (usuario_id uuid, nome text, papel text, acesso_leads boolean)
language sql stable security definer set search_path = public as $$
  select m.usuario_id, p.nome, m.papel::text, m.acesso_leads
    from membros_cliente m join perfis p on p.id = m.usuario_id
   where m.cliente_id = p_cliente and eh_membro_cliente(p_cliente)
   order by p.nome;
$$;

revoke all on function public.aceitar_convite(text) from public, anon;
revoke all on function public.equipe_cliente(uuid) from public, anon;
grant execute on function public.aceitar_convite(text) to authenticated;
grant execute on function public.equipe_cliente(uuid) to authenticated;
-- ver_convite fica aberto: a tela de convite aparece antes do login
grant execute on function public.ver_convite(text) to anon, authenticated;
