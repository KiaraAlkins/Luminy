-- Luminy · telas de Campanhas QR e Leads

-- Números por campanha (respeita a RLS: só quem tem acesso a leads vê)
create or replace function public.resumo_campanhas(p_cliente uuid)
returns table (campanha_id uuid, leituras bigint, total_leads bigint, leads_7_dias bigint, convertidos bigint)
language sql stable security invoker set search_path = public as $$
  select c.id,
         coalesce((select sum(p.leituras) from pecas_qr p where p.campanha_id = c.id), 0),
         (select count(*) from leads l where l.campanha_id = c.id),
         (select count(*) from leads l where l.campanha_id = c.id and l.criado_em > now() - interval '7 days'),
         (select count(*) from leads l where l.campanha_id = c.id and l.etapa = 'convertido')
    from campanhas c
   where c.cliente_id = p_cliente;
$$;

-- Leads por peça (cartaz, folder, banner…) para saber qual QR funciona melhor
create or replace function public.resumo_pecas(p_campanha uuid)
returns table (peca_id uuid, total_leads bigint)
language sql stable security invoker set search_path = public as $$
  select p.id, (select count(*) from leads l where l.peca_id = p.id)
    from pecas_qr p where p.campanha_id = p_campanha;
$$;

-- Toda mudança de etapa do lead entra no histórico, com quem mudou
create or replace function public.tg_lead_etapa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.etapa is distinct from old.etapa then
    insert into eventos_lead (lead_id, autor_id, tipo, detalhe)
    values (new.id, auth.uid(), 'etapa', jsonb_build_object('de', old.etapa, 'para', new.etapa, 'motivo', new.motivo_perda));
  end if;
  return new;
end $$;
create trigger lead_etapa after update of etapa on public.leads
  for each row execute function public.tg_lead_etapa();

-- Formulário público passa a mostrar a mensagem de agradecimento da campanha
create or replace function public.formulario_publico(p_slug text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select c.id, c.nome, c.situacao, c.inicio, c.fim, c.titulo_publico, c.texto_publico, c.formulario, c.mensagem_obrigado,
         cl.nome as cliente_nome, cl.cor as cliente_cor, p.id as peca_id
    into r
    from pecas_qr p join campanhas c on c.id = p.campanha_id join clientes cl on cl.id = c.cliente_id
   where p.slug = p_slug;
  if not found then return jsonb_build_object('situacao', 'inexistente'); end if;
  update pecas_qr set leituras = leituras + 1 where id = r.peca_id;
  if r.situacao <> 'ativa' or (r.fim is not null and r.fim < current_date) or (r.inicio is not null and r.inicio > current_date) then
    return jsonb_build_object('situacao', 'encerrada', 'cliente', r.cliente_nome);
  end if;
  return jsonb_build_object(
    'situacao', 'ativa',
    'cliente', r.cliente_nome,
    'cor', r.cliente_cor,
    'titulo', coalesce(r.titulo_publico, r.nome),
    'texto', r.texto_publico,
    'obrigado', r.mensagem_obrigado,
    'campos', coalesce((select jsonb_agg(f - 'valor_fixo' - 'segmento') from jsonb_array_elements(r.formulario) f
                        where f->>'modo' <> 'oculto'), '[]'::jsonb));
end $$;
