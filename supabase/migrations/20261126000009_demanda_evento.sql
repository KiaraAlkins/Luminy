-- Luminy · demanda ligada a um evento da agenda (materiais, convites, impressos para o evento)
alter table public.demandas add column evento_id uuid references public.eventos (id) on delete set null;
create index on public.demandas (evento_id);
