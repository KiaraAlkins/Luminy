import { supabase } from './supabase'
import type { Prioridade } from './kanban'

export type StatusDemanda = 'aguardando_aceite' | 'a_fazer' | 'em_andamento' | 'concluida' | 'cancelada' | 'impedida'
export type Demanda = {
  id: string; cliente_id: string; titulo: string; descricao: string | null; criado_por: string; responsavel_id: string | null
  colaboradores: string[]; status: StatusDemanda; prioridade: Prioridade; categoria: string | null; setor_solicitante: string | null
  prazo: string | null; justificativa: string | null; card_id: string | null; aceita_em: string | null; concluida_em: string | null
  posicao: number; criado_em: string; atualizado_em: string
}
export type EventoDemanda = { id: number; demanda_id: string; autor_id: string | null; tipo: 'comentario' | 'situacao' | 'criada' | 'aceita' | 'card'; texto: string | null; detalhe: Record<string, string | null>; criado_em: string; autor?: string }

export const SITUACOES: { id: StatusDemanda; nome: string; cor: string; justificativa?: boolean }[] = [
  { id: 'aguardando_aceite', nome: 'Aguardando aceite', cor: 'var(--texto-3)' },
  { id: 'a_fazer', nome: 'A fazer', cor: 'var(--info)' },
  { id: 'em_andamento', nome: 'Em andamento', cor: 'var(--alerta)' },
  { id: 'concluida', nome: 'Concluída', cor: 'var(--sucesso)' },
  { id: 'impedida', nome: 'Impedida', cor: 'var(--perigo)', justificativa: true },
  { id: 'cancelada', nome: 'Cancelada', cor: '#98A2B3', justificativa: true },
]
export const nomeSituacao = (s: StatusDemanda) => SITUACOES.find((x) => x.id === s)?.nome ?? s
export const CATEGORIAS_DEMANDA = ['Arte', 'Post', 'Vídeo', 'Fotografia', 'Evento', 'Impresso', 'Texto', 'Outro']
export const SETORES = ['Diretoria', 'Enfermagem', 'Corpo clínico', 'RH', 'Comercial', 'Qualidade', 'Recepção', 'Ouvidoria']

// ---------------------------------------------------------------- demonstração
const h = (n: number) => new Date(Date.now() + n * 3_600_000).toISOString()
const base = { descricao: null, colaboradores: [], justificativa: null, card_id: null, aceita_em: null, concluida_em: null, criado_por: 'p2' }
let demo: Demanda[] = [
  { ...base, id: 'd1', cliente_id: 'hospital', titulo: 'Convite para a palestra de diabetes', status: 'aguardando_aceite', prioridade: 'comum', categoria: 'Arte', setor_solicitante: 'Enfermagem', prazo: h(70), responsavel_id: null, posicao: 1, criado_em: h(-3), atualizado_em: h(-3),
    descricao: 'Arte para feed e story, com data 10/12 às 14h no auditório.' },
  { ...base, id: 'd4', cliente_id: 'hospital', titulo: 'Placa de boas-vindas da nova UTI', status: 'aguardando_aceite', prioridade: 'alta', categoria: 'Impresso', setor_solicitante: 'Diretoria', prazo: h(30), responsavel_id: null, posicao: 2, criado_em: h(-1), atualizado_em: h(-1) },
  { ...base, id: 'd2', cliente_id: 'hospital', titulo: 'Banner da campanha de vacinação', status: 'a_fazer', prioridade: 'alta', categoria: 'Arte', setor_solicitante: 'Enfermagem', prazo: h(6), responsavel_id: 'p1', posicao: 1, criado_em: h(-26), atualizado_em: h(-20), aceita_em: h(-20) },
  { ...base, id: 'd3', cliente_id: 'hospital', titulo: 'Vídeo depoimento da maternidade', status: 'em_andamento', prioridade: 'comum', categoria: 'Vídeo', setor_solicitante: 'Diretoria', prazo: h(52), responsavel_id: 'p1', colaboradores: ['p4'], posicao: 1, criado_em: h(-70), atualizado_em: h(-8), aceita_em: h(-60) },
  { ...base, id: 'd5', cliente_id: 'hospital', titulo: 'Fotos do novo centro cirúrgico', status: 'em_andamento', prioridade: 'comum', categoria: 'Fotografia', setor_solicitante: 'Qualidade', prazo: h(-4), responsavel_id: 'p3', posicao: 2, criado_em: h(-90), atualizado_em: h(-10), aceita_em: h(-80) },
  { ...base, id: 'd6', cliente_id: 'hospital', titulo: 'Folder do check-up executivo', status: 'concluida', prioridade: 'comum', categoria: 'Impresso', setor_solicitante: 'Comercial', prazo: h(-30), responsavel_id: 'p2', posicao: 1, criado_em: h(-200), atualizado_em: h(-28), aceita_em: h(-190), concluida_em: h(-28) },
]
let eventosDemo: EventoDemanda[] = [
  { id: 1, demanda_id: 'd3', autor_id: 'p4', autor: 'Pedro Prado', tipo: 'comentario', texto: 'Gravação marcada para quinta às 10h com a Dra. Lúcia.', detalhe: {}, criado_em: h(-8) },
  { id: 2, demanda_id: 'd3', autor_id: 'p1', autor: 'Dilan Freitas', tipo: 'situacao', texto: null, detalhe: { de: 'a_fazer', para: 'em_andamento' }, criado_em: h(-10) },
]

// ---------------------------------------------------------------- API
export async function listarDemandas(clienteId: string): Promise<Demanda[]> {
  if (!supabase) return [...demo]
  const { data, error } = await supabase.from('demandas').select('*').eq('cliente_id', clienteId).order('posicao').order('criado_em')
  if (error) throw error
  return data as Demanda[]
}

export type NovaDemanda = Pick<Demanda, 'titulo' | 'descricao' | 'categoria' | 'setor_solicitante' | 'prioridade' | 'prazo' | 'responsavel_id' | 'colaboradores'>
export async function criarDemanda(clienteId: string, d: NovaDemanda) {
  if (!supabase) {
    demo = [...demo, { ...base, ...d, id: crypto.randomUUID(), cliente_id: clienteId, status: 'aguardando_aceite', posicao: Date.now(), criado_por: 'p1', criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() }]
    return
  }
  const { error } = await supabase.from('demandas').insert({ ...d, cliente_id: clienteId, posicao: Date.now() / 1e6 })
  if (error) throw new Error('Não foi possível criar a demanda.')
}

export async function salvarDemanda(id: string, dados: Partial<Omit<Demanda, 'id' | 'cliente_id' | 'criado_por' | 'criado_em'>>) {
  if (!supabase) {
    const antes = demo.find((x) => x.id === id)
    if (antes && dados.status && dados.status !== antes.status) eventosDemo.unshift({ id: Date.now(), demanda_id: id, autor_id: 'p1', autor: 'Você', tipo: 'situacao', texto: null, detalhe: { de: antes.status, para: dados.status, justificativa: dados.justificativa ?? null }, criado_em: new Date().toISOString() })
    demo = demo.map((x) => (x.id === id ? { ...x, ...dados, concluida_em: dados.status === 'concluida' ? new Date().toISOString() : x.concluida_em } : x)); return
  }
  const { error } = await supabase.from('demandas').update(dados).eq('id', id)
  if (error) throw new Error(error.code === '23514' ? 'Escreva a justificativa.' : 'Você não pode mudar esta demanda (só o responsável, quem colabora ou um administrador).')
}

export async function aceitarDemanda(id: string, usuarioId: string) {
  if (!supabase) { await salvarDemanda(id, { status: 'a_fazer', responsavel_id: demo.find((x) => x.id === id)?.responsavel_id ?? usuarioId, aceita_em: new Date().toISOString() }); return }
  const { error } = await supabase.rpc('aceitar_demanda', { p_demanda: id })
  if (error) throw new Error(error.message.includes('outra pessoa') ? 'Esta demanda foi direcionada para outra pessoa.' : error.message.includes('já foi aceita') ? 'Alguém já aceitou esta demanda.' : 'Não foi possível aceitar.')
}

export async function excluirDemanda(id: string) {
  if (!supabase) { demo = demo.filter((x) => x.id !== id); return }
  const { error } = await supabase.from('demandas').delete().eq('id', id)
  if (error) throw new Error('Só administradores excluem demandas.')
}

export async function eventosDemanda(id: string): Promise<EventoDemanda[]> {
  if (!supabase) return eventosDemo.filter((e) => e.demanda_id === id)
  const { data } = await supabase.from('demanda_eventos').select('*').eq('demanda_id', id).order('criado_em', { ascending: false }).limit(100)
  const lista = (data ?? []) as EventoDemanda[]
  const autores = [...new Set(lista.map((e) => e.autor_id).filter(Boolean))] as string[]
  if (autores.length) {
    const p = await supabase.from('perfis').select('id, nome').in('id', autores)
    const nomes = new Map((p.data ?? []).map((x: { id: string; nome: string }) => [x.id, x.nome]))
    lista.forEach((e) => { if (e.autor_id) e.autor = nomes.get(e.autor_id) })
  }
  return lista
}

export async function comentarDemanda(id: string, texto: string) {
  if (!supabase) { eventosDemo = [{ id: Date.now(), demanda_id: id, autor_id: 'p1', autor: 'Você', tipo: 'comentario', texto, detalhe: {}, criado_em: new Date().toISOString() }, ...eventosDemo]; return }
  const { data: u } = await supabase.auth.getUser()
  const { error } = await supabase.from('demanda_eventos').insert({ demanda_id: id, tipo: 'comentario', texto, autor_id: u.user?.id })
  if (error) throw new Error('Não foi possível comentar.')
}

/** Leva a demanda para o Kanban de redes sociais (Backlog) e liga os dois. */
export async function virarCard(d: Demanda, quadroId: string, colunaId: string): Promise<string> {
  const card = { titulo: d.titulo, briefing: [d.descricao, d.setor_solicitante ? `Pedido por: ${d.setor_solicitante}` : null].filter(Boolean).join('\n\n') || null, entrega_em: d.prazo, responsaveis: [d.responsavel_id, ...d.colaboradores].filter(Boolean), prioridade: d.prioridade }
  if (!supabase) { const id = `k-${d.id}`; demo = demo.map((x) => (x.id === d.id ? { ...x, card_id: id } : x)); return id }
  const { data, error } = await supabase.from('cards').insert({ ...card, quadro_id: quadroId, coluna_id: colunaId, posicao: Date.now() / 1e6 }).select('id').single()
  if (error) throw new Error('Não foi possível criar o card.')
  await salvarDemanda(d.id, { card_id: data.id as string })
  return data.id as string
}
