-- Luminy · renomear um plano de saúde atualiza o nome nas empresas que usam o plano
create or replace function public.tg_convenio_renomeado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.nome is distinct from old.nome then
    update empresas set convenios = array_replace(convenios, old.nome, new.nome)
     where cliente_id = new.cliente_id and old.nome = any (convenios);
  end if;
  return new;
end $$;
create trigger convenio_renomeado after update of nome on public.convenios
  for each row execute function public.tg_convenio_renomeado();
