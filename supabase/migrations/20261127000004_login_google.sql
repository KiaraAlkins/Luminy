-- Luminy · login com Google: quem entra pelo Google já chega com o nome e a foto da conta Google
create or replace function public.tg_novo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, nome, foto_url)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    -- Foto do Google só se for um endereço https do Google (evita guardar qualquer link)
    case when coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture') ~ '^https://lh[0-9]\.googleusercontent\.com/'
         then coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture') end)
  on conflict (id) do nothing;
  return new;
end $$;
