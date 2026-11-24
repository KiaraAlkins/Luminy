-- Posição fracionária: soltar um card entre dois outros não exige renumerar a coluna inteira.
alter table public.cards alter column posicao type double precision;
alter table public.colunas alter column posicao type double precision;
