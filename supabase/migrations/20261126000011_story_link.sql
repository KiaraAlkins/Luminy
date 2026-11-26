-- Luminy · Stories: link com sticker nativo do Instagram (o texto que aparece no sticker)
alter table public.cards
  add column story_link text,
  add column story_link_texto text check (story_link_texto is null or char_length(story_link_texto) <= 40);
