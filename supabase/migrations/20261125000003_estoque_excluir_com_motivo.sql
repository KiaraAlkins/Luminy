-- Luminy · excluir item do estoque registrando o motivo (o item fica arquivado com o histórico)

alter table public.estoque_itens
  add column arquivado_em timestamptz,
  add column arquivado_por uuid references public.perfis (id) on delete set null,
  add column motivo_arquivamento text,
  add constraint arquivamento_com_motivo check (
    arquivado_em is null or length(trim(coalesce(motivo_arquivamento, ''))) >= 3
  );

-- O nome só precisa ser único entre os itens em uso (dá para recadastrar um item excluído)
alter table public.estoque_itens drop constraint estoque_itens_cliente_id_nome_key;
create unique index estoque_itens_nome_em_uso on public.estoque_itens (cliente_id, lower(nome)) where arquivado_em is null;

-- Quem excluiu é sempre quem está logado; ao restaurar, limpa tudo
create or replace function public.tg_item_arquivamento()
returns trigger language plpgsql as $$
begin
  if new.arquivado_em is not null and old.arquivado_em is null then
    new.arquivado_por := auth.uid();
    new.arquivado_em := now();
  elsif new.arquivado_em is null then
    new.arquivado_por := null;
    new.motivo_arquivamento := null;
  end if;
  return new;
end $$;
create trigger item_arquivamento before update on public.estoque_itens
  for each row execute function public.tg_item_arquivamento();
