-- Luminy · Meu espaço: rotina pessoal. Cada rotina gera tarefas pessoais (as mesmas de Minhas tarefas,
-- do Meu Kanban e do Calendário), uma por dia em que ela acontece. Tudo privado: só o dono vê.

create table public.rotinas_pessoais (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null check (length(trim(titulo)) > 0),
  descricao text,
  repeticao text not null default 'semana' check (repeticao in ('semana', 'mes')),
  dias_semana smallint[] not null default '{1,2,3,4,5}',
  dia_mes smallint check (dia_mes between 1 and 31),
  horario time,                                  -- sem horário = vale para o dia todo
  prioridade public.prioridade not null default 'comum',
  ativa boolean not null default true,
  inicio date not null default current_date,
  criado_em timestamptz not null default now(),
  constraint rotina_pessoal_mensal check (repeticao <> 'mes' or dia_mes is not null),
  constraint rotina_pessoal_dias check (repeticao <> 'semana' or cardinality(dias_semana) > 0)
);
alter table public.rotinas_pessoais enable row level security;
create policy rotinas_pessoais_dono on public.rotinas_pessoais for all to authenticated
  using (dono_id = auth.uid()) with check (dono_id = auth.uid());

alter table public.tarefas
  add column rotina_pessoal_id uuid references public.rotinas_pessoais (id) on delete set null,
  add column rotina_data date;
create unique index tarefa_rotina_pessoal_dia on public.tarefas (rotina_pessoal_id, rotina_data) where rotina_pessoal_id is not null;

-- Cria as tarefas das rotinas da pessoa para os próximos dias (sem duplicar). Roda com as permissões de quem chama.
create or replace function public.gerar_rotinas_pessoais(p_dias int default 14, p_fuso text default 'America/Sao_Paulo')
returns int language plpgsql security invoker set search_path = public as $$
declare v_n int;
begin
  insert into tarefas (dono_id, titulo, descricao, prazo, prioridade, rotina_pessoal_id, rotina_data)
  select r.dono_id, r.titulo, r.descricao, ((d.dia + coalesce(r.horario, time '23:59')) at time zone p_fuso), r.prioridade, r.id, d.dia
    from rotinas_pessoais r
    cross join lateral (select g::date as dia from generate_series((now() at time zone p_fuso)::date, (now() at time zone p_fuso)::date + least(greatest(p_dias, 1), 60) - 1, interval '1 day') g) d
   where r.dono_id = auth.uid() and r.ativa and d.dia >= r.inicio
     and ((r.repeticao = 'semana' and extract(dow from d.dia)::int = any (r.dias_semana))
       or (r.repeticao = 'mes' and extract(day from d.dia)::int = least(r.dia_mes, extract(day from (date_trunc('month', d.dia) + interval '1 month - 1 day'))::int)))
  on conflict (rotina_pessoal_id, rotina_data) where rotina_pessoal_id is not null do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
grant execute on function public.gerar_rotinas_pessoais(int, text) to authenticated;
