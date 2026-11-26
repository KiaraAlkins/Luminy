-- Luminy · responsáveis em cada card (vários, como no Trello)

alter table public.cards add column responsaveis uuid[] not null default '{}';
create index on public.cards using gin (responsaveis);

-- Pessoas que podem ser responsáveis: a equipe do cliente e o dono da agência
create or replace function public.pessoas_cliente(p_cliente uuid)
returns table (usuario_id uuid, nome text, foto_url text)
language sql stable security definer set search_path = public as $$
  select distinct on (p.id) p.id, p.nome, p.foto_url
    from perfis p
   where eh_membro_cliente(p_cliente) and (
         p.id in (select m.usuario_id from membros_cliente m where m.cliente_id = p_cliente)
      or p.id in (select a.proprietario_id from clientes c join agencias a on a.id = c.agencia_id where c.id = p_cliente))
   order by p.id;
$$;
revoke all on function public.pessoas_cliente(uuid) from public, anon;
grant execute on function public.pessoas_cliente(uuid) to authenticated;
