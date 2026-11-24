-- Testes das regras de acesso do Luminy.
-- Rodar com: npm run test:db
\set ON_ERROR_STOP on
-- Mesmas permissões de tabela que o Supabase concede; quem filtra é a RLS.
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage on all sequences in schema public to anon, authenticated;

create schema if not exists t;
create or replace function t.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
grant usage on schema t to anon, authenticated;
grant execute on function t.ok(boolean, text) to anon, authenticated;

-- ---------------------------------------------------------------- dados (superusuário, sem RLS)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000d11a', 'dilan@exemplo.com'),
  ('00000000-0000-0000-0000-00000000c1a2', 'kiara@exemplo.com'),
  ('00000000-0000-0000-0000-00000000b2a1', 'braion@exemplo.com'),
  ('00000000-0000-0000-0000-00000000a9e1', 'aprendiz@exemplo.com'),
  ('00000000-0000-0000-0000-00000000f07a', 'fora@exemplo.com');

insert into agencias (id, nome, proprietario_id) values
  ('10000000-0000-0000-0000-000000000001', 'Luminy', '00000000-0000-0000-0000-00000000d11a');
insert into clientes (id, agencia_id, nome, slug) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Hospital Santa Marta', 'hospital-santa-marta'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Cliente privado', 'cliente-privado');
insert into membros_cliente (cliente_id, usuario_id, papel, acesso_leads) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000c1a2', 'admin', true),
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000b2a1', 'membro', true),
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000a9e1', 'membro', false);

insert into tarefas (dono_id, titulo) values ('00000000-0000-0000-0000-00000000b2a1', 'Tarefa pessoal do Braion');
insert into demandas (cliente_id, titulo, criado_por) values
  ('20000000-0000-0000-0000-000000000001', 'Arte vacinação', '00000000-0000-0000-0000-00000000c1a2'),
  ('20000000-0000-0000-0000-000000000002', 'Demanda do cliente privado', '00000000-0000-0000-0000-00000000d11a');

insert into campanhas (id, cliente_id, nome, situacao, formulario, criado_por) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Dia do Homem 2026', 'ativa',
   '[{"chave":"nome","rotulo":"Nome completo","tipo":"texto","modo":"obrigatorio"},
     {"chave":"whatsapp","rotulo":"WhatsApp","tipo":"telefone","modo":"obrigatorio"},
     {"chave":"email","rotulo":"E-mail","tipo":"email","modo":"exibir"},
     {"chave":"convenio","rotulo":"Convênio","tipo":"lista","modo":"oculto","valor_fixo":"Empresa X"},
     {"chave":"diabetes","rotulo":"Tem diabetes ou histórico na família?","tipo":"sim_nao","modo":"exibir","segmento":"Risco de diabetes"}]',
   '00000000-0000-0000-0000-00000000d11a'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Outubro Rosa', 'encerrada', '[]',
   '00000000-0000-0000-0000-00000000d11a');
insert into pecas_qr (campanha_id, nome, slug) values
  ('30000000-0000-0000-0000-000000000001', 'Cartaz da recepção', 'dh26-cartaz'),
  ('30000000-0000-0000-0000-000000000002', 'Cartaz antigo', 'or26-cartaz');

-- ---------------------------------------------------------------- visitante anônimo (formulário do QR)
set role anon;
select set_config('request.jwt.claims', '{}', false);

select t.ok(formulario_publico('dh26-cartaz')->>'situacao' = 'ativa', 'formulário ativo abre para visitante');
select t.ok(jsonb_array_length(formulario_publico('dh26-cartaz')->'campos') = 4, 'campo oculto (convênio) não aparece no formulário');
select t.ok(position('Empresa X' in formulario_publico('dh26-cartaz')::text) = 0, 'valor fixo oculto não vaza para o público');
select t.ok(formulario_publico('or26-cartaz')->>'situacao' = 'encerrada', 'campanha encerrada mostra aviso');

-- tenta forçar outro convênio: deve ser ignorado
select enviar_lead('dh26-cartaz',
  '{"nome":"Carlos Teste","whatsapp":"61988124821","convenio":"Outro","diabetes":"sim"}', true, true);
select enviar_lead('dh26-cartaz', '{"nome":"Sem campanhas","whatsapp":"61900000000","diabetes":"não"}', true, false);

do $$ begin
  perform enviar_lead('dh26-cartaz', '{"nome":"Sem aceite","whatsapp":"1"}', false);
  raise exception 'FALHOU: enviou sem aceite de contato';
exception when check_violation then raise notice 'ok - sem aceite de contato o envio é recusado';
end $$;
do $$ begin
  perform enviar_lead('dh26-cartaz', '{"nome":"Sem whats"}', true);
  raise exception 'FALHOU: aceitou sem campo obrigatório';
exception when check_violation then raise notice 'ok - campo obrigatório é exigido';
end $$;
do $$ begin
  perform enviar_lead('or26-cartaz', '{"nome":"x"}', true);
  raise exception 'FALHOU: aceitou lead em campanha encerrada';
exception when check_violation then raise notice 'ok - campanha encerrada não aceita envios';
end $$;
select t.ok((select count(*) from leads) = 0, 'visitante anônimo não consegue ler leads');
reset role;

select t.ok((select dados->>'convenio' from leads where nome = 'Carlos Teste') = 'Empresa X', 'convênio oculto gravado com o valor fixo, mesmo com tentativa de troca');
select t.ok((select 'Risco de diabetes' = any (segmentos) from leads where nome = 'Carlos Teste'), 'resposta "sim" vira segmento Risco de diabetes');
select t.ok((select aceite_campanhas_em is null from leads where nome = 'Sem campanhas'), 'aceite de campanhas fica separado do aceite de contato');
select t.ok((select leituras from pecas_qr where slug = 'dh26-cartaz') >= 3, 'leituras do QR são contadas');

-- ---------------------------------------------------------------- Dilan (proprietário)
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000d11a"}', false);
select t.ok((select count(*) from clientes) = 2, 'proprietário vê todos os clientes');
select t.ok((select count(*) from leads) = 2, 'proprietário vê os leads');
select t.ok((select count(*) from tarefas) = 0, 'proprietário NÃO vê tarefas pessoais de outras pessoas');
select criar_quadro_redes_sociais('20000000-0000-0000-0000-000000000001');
select t.ok((select count(*) from colunas) = 6, 'quadro oficial nasce com as 6 colunas');

-- ---------------------------------------------------------------- Kiara (admin do hospital)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c1a2"}', false);
select t.ok((select count(*) from clientes) = 1, 'equipe do hospital vê só o hospital');
select t.ok((select count(*) from clientes where slug = 'cliente-privado') = 0, 'cliente privado é invisível para a equipe do hospital');
select t.ok((select count(*) from demandas) = 1, 'demandas do cliente privado não aparecem');
select t.ok((select count(*) from tarefas) = 0, 'admin do cliente NÃO vê tarefas pessoais');
select t.ok((select count(*) from leads) = 2, 'admin com acesso a leads vê os leads');
select t.ok((select count(*) from abrir_lead((select id from leads where nome = 'Carlos Teste'))) = 1, 'abrir lead funciona');
select t.ok((select count(*) from eventos_lead where tipo = 'aberto') = 1, 'abertura do lead fica registrada');

-- ---------------------------------------------------------------- Braion (membro)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b2a1"}', false);
select t.ok((select count(*) from tarefas) = 1, 'cada pessoa vê a própria tarefa pessoal');
do $$
declare v_card uuid; v_imp uuid; v_faz uuid;
begin
  select id into v_faz from colunas where nome = 'Fazendo';
  select id into v_imp from colunas where nome = 'Impedimento';
  insert into cards (quadro_id, coluna_id, titulo) select quadro_id, v_faz, 'Carrossel' from colunas where id = v_faz returning id into v_card;
  begin
    update cards set coluna_id = v_imp where id = v_card;
    raise exception 'FALHOU: moveu para Impedimento sem motivo';
  exception when check_violation then raise notice 'ok - Impedimento exige motivo';
  end;
  update cards set coluna_id = v_imp, motivo_impedimento = 'Aguardando autorização de imagem' where id = v_card;
  perform t.ok((select coluna_antes_impedimento = v_faz from cards where id = v_card), 'Impedimento guarda a coluna de origem');
end $$;
do $$ begin
  insert into colunas (quadro_id, nome, posicao) select id, 'Coluna nova', 7 from quadros limit 1;
  raise exception 'FALHOU: membro criou coluna no quadro oficial';
exception when insufficient_privilege then raise notice 'ok - só administradores mexem nas colunas do quadro oficial';
end $$;

-- ---------------------------------------------------------------- Jovem aprendiz (sem acesso a leads)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a9e1"}', false);
select t.ok((select count(*) from clientes) = 1, 'jovem aprendiz vê o hospital');
select t.ok((select count(*) from demandas) = 1, 'jovem aprendiz vê as demandas');
select t.ok((select count(*) from leads) = 0, 'jovem aprendiz NÃO vê leads');
select t.ok((select count(*) from campanhas) = 0, 'jovem aprendiz NÃO vê campanhas QR');
do $$ begin
  perform abrir_lead((select id from leads limit 1));
  raise exception 'FALHOU: aprendiz abriu lead';
exception when others then
  if sqlerrm like 'FALHOU%' then raise; end if;
  raise notice 'ok - jovem aprendiz não consegue abrir lead';
end $$;

-- ---------------------------------------------------------------- Pessoa de fora
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f07a"}', false);
select t.ok((select count(*) from clientes) = 0, 'pessoa de fora não vê nenhum cliente');
select t.ok((select count(*) from demandas) = 0, 'pessoa de fora não vê demandas');
reset role;

-- ---------------------------------------------------------------- Login, sessão e equipe
select t.ok((select count(*) from perfis) = 5, 'perfil é criado automaticamente no cadastro');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000d11a"}', false);
select t.ok(iniciar_agencia('Outra') = '10000000-0000-0000-0000-000000000001', 'iniciar agência não cria uma segunda agência para o mesmo dono');
select t.ok((minha_sessao()->'agencia'->>'nome') = 'Luminy', 'sessão do proprietário traz a agência');
select t.ok(jsonb_array_length(minha_sessao()->'clientes') = 2, 'sessão do proprietário traz os 2 clientes');
select criar_cliente('10000000-0000-0000-0000-000000000001', 'Clínica Vitalis');
select t.ok((select slug from clientes where nome = 'Clínica Vitalis') = 'clinica-vitalis', 'cliente novo ganha endereço sem acento');
select t.ok((select count(*) from quadros q join clientes c on c.id = q.cliente_id where c.slug = 'clinica-vitalis') = 1, 'cliente novo já nasce com o quadro de redes sociais');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a9e1"}', false);
select t.ok((minha_sessao()->'clientes'->0->>'acesso_leads')::boolean = false, 'sessão do jovem aprendiz indica sem acesso a leads');
select t.ok(minha_sessao()->'agencia' = 'null'::jsonb, 'jovem aprendiz não tem agência');
do $$ begin
  perform adicionar_membro('20000000-0000-0000-0000-000000000001', 'fora@exemplo.com');
  raise exception 'FALHOU: membro comum adicionou pessoa';
exception when others then
  if sqlerrm like 'FALHOU%' then raise; end if;
  raise notice 'ok - só administradores adicionam pessoas ao cliente';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c1a2"}', false);
select adicionar_membro('20000000-0000-0000-0000-000000000001', 'FORA@exemplo.com', 'membro', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f07a"}', false);
select t.ok((select count(*) from clientes) = 1 and (select count(*) from leads) = 0, 'pessoa adicionada sem acesso a leads vê o cliente, mas não os leads');
reset role;
set role anon;
do $$ begin
  perform minha_sessao();
  raise exception 'FALHOU: visitante chamou minha_sessao';
exception when insufficient_privilege then raise notice 'ok - visitante anônimo não acessa funções internas';
end $$;
reset role;

-- ---------------------------------------------------------------- Convites
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c1a2"}', false);
insert into convites (cliente_id, email, papel, acesso_leads)
  values ('20000000-0000-0000-0000-000000000001', 'aprendiz2@exemplo.com', 'membro', false);
insert into convites (id, cliente_id, papel) values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'membro');
select t.ok((select count(*) from convites) = 2, 'admin do cliente cria e vê convites');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b2a1"}', false);
select t.ok((select count(*) from convites) = 0, 'membro comum não vê os convites (tokens ficam protegidos)');
do $$ begin
  insert into convites (cliente_id) values ('20000000-0000-0000-0000-000000000001');
  raise exception 'FALHOU: membro comum criou convite';
exception when insufficient_privilege then raise notice 'ok - só administradores convidam';
end $$;
reset role;
-- pessoa convidada por e-mail cria a conta: entra sozinha no cliente, sem leads
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000a9e22', 'Aprendiz2@exemplo.com');
select t.ok((select acesso_leads = false from membros_cliente where usuario_id = '00000000-0000-0000-0000-0000000a9e22'), 'convite por e-mail é aceito sozinho no cadastro, com as permissões definidas');
-- convite por link
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000111a1', 'link@exemplo.com');
select token as tk from convites where id = '40000000-0000-0000-0000-000000000001' \gset
set role anon;
select t.ok((ver_convite(:'tk')->>'cliente') = 'Hospital Santa Marta', 'visitante vê o nome do cliente no convite antes de entrar');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000111a1"}', false);
select t.ok((select count(*) from clientes) = 0, 'conta nova não vê nenhum cliente antes de aceitar convite');

reset role;
do $$ declare v_token text; begin
  select token into v_token from convites where id = '40000000-0000-0000-0000-000000000001';
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000111a1"}', false);
  set local role authenticated;
  perform aceitar_convite(v_token);
  perform t.ok((select count(*) from clientes) = 1, 'aceitar convite pelo link dá acesso ao cliente');
end $$;
do $$ declare v_token text; begin
  select token into v_token from convites where id = '40000000-0000-0000-0000-000000000001';
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f07a"}', false);
  set local role authenticated;
  perform aceitar_convite(v_token);
  raise exception 'FALHOU: convite usado duas vezes';
exception when others then
  if sqlerrm like 'FALHOU%' then raise; end if;
  raise notice 'ok - convite por link só pode ser usado uma vez';
end $$;
reset role;

\warn 'Todos os testes de acesso passaram.'
