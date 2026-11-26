import { supabase } from './supabase'
import type { Prioridade } from './kanban'

export type StatusTarefa = 'a_fazer' | 'em_andamento' | 'concluida' | 'cancelada' | 'impedida'
export type Tarefa = { id: string; titulo: string; descricao: string | null; prazo: string | null; prioridade: Prioridade; status: StatusTarefa; concluida_em: string | null; criado_em: string }

/** Tudo o que é "meu" para fazer: tarefa pessoal, demanda que aceitei ou card do Kanban em que sou responsável. */
export type MeuItem = {
  id: string; origem: 'tarefa' | 'demanda' | 'card' | 'os'; titulo: string; prazo: string | null; prioridade: Prioridade
  concluida: boolean; concluida_em: string | null; cliente_id: string | null; detalhe?: string; descricao?: string | null
}

const agora = Date.now()
const em = (h: number) => new Date(agora + h * 3_600_000).toISOString()
let tarefasDemo: Tarefa[] = [
  { id: 't1', titulo: 'Responder o RH da Empresa X sobre o mutirão', descricao: null, prazo: em(-3), prioridade: 'alta', status: 'a_fazer', concluida_em: null, criado_em: em(-30) },
  { id: 't2', titulo: 'Separar fotos do evento de ontem', descricao: null, prazo: em(4), prioridade: 'comum', status: 'a_fazer', concluida_em: null, criado_em: em(-5) },
  { id: 't3', titulo: 'Pedir orçamento de squeezes', descricao: 'Pelo menos 3 fornecedores', prazo: em(28), prioridade: 'comum', status: 'a_fazer', concluida_em: null, criado_em: em(-5) },
  { id: 't4', titulo: 'Atualizar a planilha de leads da campanha', descricao: null, prazo: em(80), prioridade: 'baixa', status: 'a_fazer', concluida_em: null, criado_em: em(-5) },
  { id: 't5', titulo: 'Estudar o novo formato de Reels', descricao: null, prazo: null, prioridade: 'baixa', status: 'a_fazer', concluida_em: null, criado_em: em(-50) },
  { id: 't6', titulo: 'Enviar relatório de outubro', descricao: null, prazo: em(-20), prioridade: 'comum', status: 'concluida', concluida_em: em(-22), criado_em: em(-80) },
]
const extrasDemo: MeuItem[] = [
  { id: 'd2', origem: 'demanda', titulo: 'Banner da campanha de vacinação', prazo: em(6), prioridade: 'alta', concluida: false, concluida_em: null, cliente_id: 'hospital', detalhe: 'Demanda · Enfermagem' },
  { id: 'k4', origem: 'card', titulo: 'Carrossel Novembro Azul', prazo: em(-40), prioridade: 'alta', concluida: false, concluida_em: null, cliente_id: 'hospital', detalhe: 'Kanban · Fazendo' },
  { id: 'o1', origem: 'os', titulo: 'OS 48213: Placa de identificação da nova UTI', prazo: em(50), prioridade: 'alta', concluida: false, concluida_em: null, cliente_id: 'hospital', detalhe: 'OS · UTI' },
  { id: 'd3', origem: 'demanda', titulo: 'Vídeo depoimento da maternidade', prazo: em(52), prioridade: 'comum', concluida: false, concluida_em: null, cliente_id: 'hospital', detalhe: 'Demanda · Diretoria' },
]

const deTarefa = (t: Tarefa): MeuItem => ({ id: t.id, origem: 'tarefa', titulo: t.titulo, prazo: t.prazo, prioridade: t.prioridade, concluida: t.status === 'concluida', concluida_em: t.concluida_em, cliente_id: null, descricao: t.descricao })

/** Junta tarefas pessoais, demandas e cards do Kanban de todos os clientes que a pessoa acessa. */
export async function meusItens(usuarioId: string): Promise<MeuItem[]> {
  if (!supabase) return [...tarefasDemo.map(deTarefa), ...extrasDemo]
  const semana = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const [t, d, c, o] = await Promise.all([
    supabase.from('tarefas').select('*').or(`status.neq.concluida,concluida_em.gte.${semana}`).neq('status', 'cancelada').order('prazo', { nullsFirst: false }),
    supabase.from('demandas').select('id, titulo, prazo, prioridade, status, concluida_em, cliente_id, setor_solicitante')
      .or(`responsavel_id.eq.${usuarioId},colaboradores.cs.{${usuarioId}}`).in('status', ['a_fazer', 'em_andamento', 'concluida', 'impedida']),
    supabase.from('cards').select('id, titulo, entrega_em, postagem_em, prioridade, colunas(nome), quadros(cliente_id)').contains('responsaveis', [usuarioId]),
    supabase.from('ordens_servico').select('id, numero, titulo, prazo, prioridade, situacao, setor, cliente_id, concluida_em').eq('responsavel_id', usuarioId).neq('situacao', 'cancelada'),
  ])
  const itens: MeuItem[] = ((t.data ?? []) as Tarefa[]).map(deTarefa)
  ;((d.data ?? []) as { id: string; titulo: string; prazo: string | null; prioridade: Prioridade; status: string; concluida_em: string | null; cliente_id: string; setor_solicitante: string | null }[])
    .filter((x) => x.status !== 'concluida' || (x.concluida_em ?? '') >= semana)
    .forEach((x) => itens.push({ id: x.id, origem: 'demanda', titulo: x.titulo, prazo: x.prazo, prioridade: x.prioridade, concluida: x.status === 'concluida', concluida_em: x.concluida_em, cliente_id: x.cliente_id, detalhe: `Demanda${x.setor_solicitante ? ` · ${x.setor_solicitante}` : ''}` }))
  ;((c.data ?? []) as unknown as { id: string; titulo: string; entrega_em: string | null; postagem_em: string | null; prioridade: Prioridade; colunas: { nome: string } | null; quadros: { cliente_id: string | null } | null }[])
    .forEach((x) => {
      const feito = /postado|feito/i.test(x.colunas?.nome ?? '')
      if (!feito) itens.push({ id: x.id, origem: 'card', titulo: x.titulo, prazo: x.entrega_em ?? x.postagem_em, prioridade: x.prioridade, concluida: false, concluida_em: null, cliente_id: x.quadros?.cliente_id ?? null, detalhe: `Kanban · ${x.colunas?.nome ?? ''}` })
    })
  ;((o.data ?? []) as { id: string; numero: string; titulo: string; prazo: string | null; prioridade: Prioridade; situacao: string; setor: string | null; cliente_id: string; concluida_em: string | null }[])
    .filter((x) => x.situacao !== 'concluida' || (x.concluida_em ?? '') >= semana)
    .forEach((x) => itens.push({ id: x.id, origem: 'os', titulo: `OS ${x.numero}: ${x.titulo}`, prazo: x.prazo ? `${x.prazo}T18:00:00` : null, prioridade: x.prioridade, concluida: x.situacao === 'concluida', concluida_em: x.concluida_em, cliente_id: x.cliente_id, detalhe: `OS${x.setor ? ` · ${x.setor}` : ''}${x.situacao === 'aguardando' ? ' · aguardando' : ''}` }))
  return itens
}

export async function criarTarefa(titulo: string, prazo: string | null, prioridade: Prioridade = 'comum') {
  if (!supabase) { tarefasDemo = [{ id: crypto.randomUUID(), titulo, descricao: null, prazo, prioridade, status: 'a_fazer', concluida_em: null, criado_em: new Date().toISOString() }, ...tarefasDemo]; return }
  const { error } = await supabase.from('tarefas').insert({ titulo, prazo, prioridade })
  if (error) throw new Error('Não foi possível criar a tarefa.')
}

export async function salvarTarefa(id: string, dados: Partial<Pick<Tarefa, 'titulo' | 'descricao' | 'prazo' | 'prioridade' | 'status'>>) {
  if (!supabase) {
    tarefasDemo = tarefasDemo.map((t) => (t.id === id ? { ...t, ...dados, concluida_em: dados.status === 'concluida' ? new Date().toISOString() : dados.status ? null : t.concluida_em } : t))
    const extra = extrasDemo.find((x) => x.id === id); if (extra && dados.status) { extra.concluida = dados.status === 'concluida'; extra.concluida_em = extra.concluida ? new Date().toISOString() : null }
    return
  }
  const { error } = await supabase.from('tarefas').update(dados).eq('id', id)
  if (error) throw new Error('Não foi possível salvar.')
}

export async function excluirTarefa(id: string) {
  if (!supabase) { tarefasDemo = tarefasDemo.filter((t) => t.id !== id); return }
  await supabase.from('tarefas').delete().eq('id', id)
}
