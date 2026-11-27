-- Luminy · TV do marketing: mostrar (ou não) as campanhas acontecendo agora e as próximas datas
alter table public.paineis_tv add column mostrar_campanhas boolean not null default true;

create or replace function public.painel_tv(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_cliente uuid; v_nome text; v_cor text; v_campanhas boolean;
begin
  select t.cliente_id, c.nome, c.cor, t.mostrar_campanhas into v_cliente, v_nome, v_cor, v_campanhas
    from paineis_tv t join clientes c on c.id = t.cliente_id where t.token = p_token;
  if v_cliente is null then return null; end if;
  return jsonb_build_object(
    'cliente', v_nome, 'cor', v_cor, 'agora', now(),
    'mostrar_campanhas', v_campanhas,
    -- Campanhas e datas criadas pela equipe (as datas da saúde já vêm no próprio painel)
    'campanhas', case when v_campanhas then coalesce((
      select jsonb_agg(jsonb_build_object('id', cp.id, 'nome', cp.nome, 'descricao', cp.descricao, 'cor', cp.cor, 'inicio', cp.inicio, 'fim', cp.fim, 'anual', cp.anual))
        from campanhas_pauta cp where cp.cliente_id = v_cliente), '[]'::jsonb) else '[]'::jsonb end,
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
