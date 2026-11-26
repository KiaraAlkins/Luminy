-- Luminy · importar leads e itens do estoque a partir de planilhas (Excel, CSV ou Google Planilhas)

-- Leads: só administradores com acesso a leads. Pula repetidos (mesmo WhatsApp ou e-mail) e registra a origem.
create or replace function public.importar_leads(p_cliente uuid, p_linhas jsonb, p_origem text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb; v_nome text; v_whats text; v_email text; v_digitos text; v_etapa etapa_lead; v_lead uuid;
  v_inseridos int := 0; v_repetidos int := 0; v_invalidos int := 0;
begin
  if not (pode_ver_leads(p_cliente) and eh_admin_cliente(p_cliente)) then
    raise exception 'Só administradores com acesso a leads importam planilhas' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_linhas) <> 'array' or jsonb_array_length(p_linhas) > 5000 then
    raise exception 'Envie até 5.000 linhas por vez' using errcode = 'check_violation';
  end if;

  for r in select * from jsonb_array_elements(p_linhas) loop
    v_nome := nullif(trim(r->>'nome'), '');
    v_whats := nullif(trim(r->>'whatsapp'), '');
    v_email := lower(nullif(trim(r->>'email'), ''));
    v_digitos := nullif(regexp_replace(coalesce(v_whats, ''), '\D', '', 'g'), '');
    if v_nome is null or (v_digitos is null and v_email is null) then v_invalidos := v_invalidos + 1; continue; end if;

    if exists (select 1 from leads l where l.cliente_id = p_cliente and (
         (v_digitos is not null and right(regexp_replace(coalesce(l.whatsapp, ''), '\D', '', 'g'), 10) = right(v_digitos, 10)) or
         (v_email is not null and lower(l.email) = v_email))) then
      v_repetidos := v_repetidos + 1; continue;
    end if;

    begin v_etapa := coalesce(nullif(r->>'etapa', '')::etapa_lead, 'novo'); exception when others then v_etapa := 'novo'; end;

    insert into leads (cliente_id, nome, whatsapp, email, dados, segmentos, etapa, motivo_perda, aceite_contato_em, aceite_campanhas_em)
    values (p_cliente, v_nome, v_whats, v_email,
            coalesce(r->'dados', '{}'::jsonb),
            coalesce((select array_agg(distinct trim(s)) from jsonb_array_elements_text(coalesce(r->'segmentos', '[]'::jsonb)) s where trim(s) <> ''), '{}'),
            case when v_etapa = 'perdido' then 'novo'::etapa_lead else v_etapa end, null,
            now(), case when coalesce((r->>'aceita_campanhas')::boolean, false) then now() end)
    returning id into v_lead;
    insert into eventos_lead (lead_id, autor_id, tipo, detalhe) values (v_lead, auth.uid(), 'importado', jsonb_build_object('origem', p_origem));
    v_inseridos := v_inseridos + 1;
  end loop;

  return jsonb_build_object('inseridos', v_inseridos, 'repetidos', v_repetidos, 'invalidos', v_invalidos);
end $$;

-- Estoque: cria os itens novos e atualiza os que já existem (pelo nome).
-- Quantidade diferente vira um "ajuste" no histórico, como uma contagem.
create or replace function public.importar_estoque(p_cliente uuid, p_linhas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb; v_nome text; v_item record; v_id uuid; v_qtd numeric;
  v_novos int := 0; v_atualizados int := 0; v_invalidos int := 0;
begin
  if not eh_membro_cliente(p_cliente) then
    raise exception 'Sem acesso a este cliente' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_linhas) <> 'array' or jsonb_array_length(p_linhas) > 2000 then
    raise exception 'Envie até 2.000 linhas por vez' using errcode = 'check_violation';
  end if;

  for r in select * from jsonb_array_elements(p_linhas) loop
    v_nome := nullif(trim(r->>'nome'), '');
    if v_nome is null then v_invalidos := v_invalidos + 1; continue; end if;
    begin v_qtd := nullif(r->>'quantidade', '')::numeric; exception when others then v_qtd := null; end;
    if v_qtd is not null and v_qtd < 0 then v_invalidos := v_invalidos + 1; continue; end if;

    select * into v_item from estoque_itens where cliente_id = p_cliente and lower(nome) = lower(v_nome) and arquivado_em is null;
    if found then
      update estoque_itens set
        categoria = coalesce(nullif(r->>'categoria', ''), categoria),
        unidade = coalesce(nullif(r->>'unidade', ''), unidade),
        minimo = coalesce(nullif(r->>'minimo', '')::numeric, minimo),
        local = coalesce(nullif(r->>'local', ''), local),
        validade = coalesce(nullif(r->>'validade', '')::date, validade)
      where id = v_item.id;
      if v_qtd is not null and v_qtd <> v_item.quantidade then
        insert into estoque_movimentos (item_id, tipo, quantidade, motivo) values (v_item.id, 'ajuste', v_qtd, 'Importado da planilha');
      end if;
      v_atualizados := v_atualizados + 1;
    else
      insert into estoque_itens (cliente_id, nome, categoria, unidade, minimo, local, validade)
      values (p_cliente, v_nome, nullif(r->>'categoria', ''), coalesce(nullif(r->>'unidade', ''), 'un'),
              coalesce(nullif(r->>'minimo', '')::numeric, 0), nullif(r->>'local', ''), nullif(r->>'validade', '')::date)
      returning id into v_id;
      if coalesce(v_qtd, 0) > 0 then
        insert into estoque_movimentos (item_id, tipo, quantidade, motivo) values (v_id, 'entrada', v_qtd, 'Importado da planilha');
      end if;
      v_novos := v_novos + 1;
    end if;
  end loop;

  return jsonb_build_object('novos', v_novos, 'atualizados', v_atualizados, 'invalidos', v_invalidos);
end $$;
