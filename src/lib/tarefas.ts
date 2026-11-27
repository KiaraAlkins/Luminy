import { supabase } from './supabase'
import type { Prioridade } from './kanban'
import { dataIso, descreverRepeticao, feitoPor, listarRegistros, listarRotinas, minha, ocorrenciasNoDia, prazoDe, type Ocorrencia } from './rotinas'

export type StatusTarefa = 'a_fazer' | 'em_andamento' | 'concluida' | 'cancelada' | 'impedida'
export type Tarefa = { id: string; titulo: string; descricao: string | null; prazo: string | null; prioridade: Prioridade; status: StatusTarefa; concluida_em: string | null; criado_em: string; rotina_pessoal_id?: string | null; rotina_data?: string | null }

/** Tudo o que é "meu" para fazer: tarefa pessoal, demanda que aceitei ou card do Kanban em que sou responsável. */
export type MeuItem = {
  id: string; origem: 'tarefa' | 'demanda' | 'card' | 'os' | 'rotina'; titulo: string; prazo: string | null; prioridade: Prioridade
  concluida: boolean; concluida_em: string | null; cliente_id: string | null; detalhe?: string; descricao?: string | null
  /** Rotinas: a ocorrência de hoje e o registro (se já foi feita) */
  ocorrencia?: Ocorrencia; registroId?: string
  /** Tarefas pessoais: em que coluna do Meu Kanban está e se veio da Minha rotina */
  status?: StatusTarefa; rotinaPessoal?: boolean
}

const agora = Date.now()
const em = (h: number) => new Date(agora + h * 3_600_000).toISOString()
let tarefasDemo: Tarefa[] = [
  { id: 't1', titulo: 'Responder o RH da Empresa X sobre o mutirão', descricao: null, prazo: em(-3), prioridade: 'alta', status: 'a_fazer', concluida_em: null, criado_em: em(-30) },
  { id: 't2', titulo: 'Separar fotos do evento de ontem', descricao: null, prazo: em(4), prioridade: 'comum', status: 'em_andamento', concluida_em: null, criado_em: em(-5) },
  { id: 't3', titulo: 'Pedir orçamento de squeezes', descricao: 'Pelo menos 3 fornecedores', prazo: em(28), prioridade: 'comum', status: 'a_fazer', concluida_em: null, criado_em: em(-5) },
  { id: 't4', titulo: 'Atualizar a planilha de leads da campanha', descricao: null, prazo: em(80), prioridade: 'baixa', status: 'a_fazer', concluida_em: null, criado_em: em(-5) },
  { id: 't5', titulo: 'Estudar o novo formato de Reels', descricao: null, prazo: null, prioridade: 'baixa', status: 'a_fazer', concluida_em: null, criado_em: em(-50) },
  { id: 't6', titulo: 'Enviar relatório de outubro', descricao: null, prazo: em(-20), prioridade: 'comum', status: 'concluida', concluida_em: em(-22), criado_em: em(-80) },
]
// Histórico de exemplo da rotina "e-mails": feita na maioria dos dias úteis passados
for (let n = 1; n <= 10; n++) {
  const d = new Date(agora - n * 86_400_000)
  if (d.getDay() === 0 || d.getDay() === 6) continue
  const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const feita = n !== 3
  tarefasDemo.push({ id: `h${n}`, titulo: 'Conferir a caixa de entrada e responder e-mails', descricao: null, prazo: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8, 30).toISOString(), prioridade: 'comum',
    status: feita ? 'concluida' : 'a_fazer', concluida_em: feita ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 10).toISOString() : null, criado_em: d.toISOString(), rotina_pessoal_id: 'rp1', rotina_data: dia })
}
const extrasDemo: MeuItem[] = [
  { id: 'k4', origem: 'card', titulo: 'Carrossel Novembro Azul', prazo: em(-40), prioridade: 'alta', concluida: false, concluida_em: null, cliente_id: 'hospital', detalhe: 'Kanban · Fazendo' },
  { id: 'o1', origem: 'os', titulo: 'OS 48213: Placa de identificação da nova UTI', prazo: em(50), prioridade: 'alta', concluida: false, concluida_em: null, cliente_id: 'hospital', detalhe: 'OS · UTI' },
]

const deTarefa = (t: Tarefa): MeuItem => ({ id: t.id, origem: 'tarefa', titulo: t.titulo, prazo: t.prazo, prioridade: t.prioridade, concluida: t.status === 'concluida', concluida_em: t.concluida_em, cliente_id: null, descricao: t.descricao,
  status: t.status, rotinaPessoal: !!t.rotina_pessoal_id, detalhe: t.rotina_pessoal_id ? 'Minha rotina' : t.status === 'em_andamento' ? 'Fazendo' : t.status === 'impedida' ? 'Travada' : undefined })

/** Junta tarefas pessoais, demandas e cards do Kanban de todos os clientes que a pessoa acessa. */
export async function meusItens(usuarioId: string): Promise<MeuItem[]> {
  await gerarRotinasPessoais()
  const rotinas = await minhasRotinasHoje(usuarioId)
  if (!supabase) return [...tarefasDemo.map(deTarefa), ...extrasDemo, ...rotinas]
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
  return [...itens, ...rotinas]
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

/** Rotinas de hoje que são da pessoa (ou de qualquer um da equipe), de todos os clientes. */
export async function minhasRotinasHoje(usuarioId: string): Promise<MeuItem[]> {
  const rotinas = (await listarRotinas().catch(() => [])).filter((r) => minha(r, usuarioId))
  const hoje = new Date()
  const ocs = rotinas.flatMap((r) => ocorrenciasNoDia(r, hoje))
  if (!ocs.length) return []
  const registros = await listarRegistros([...new Set(ocs.map((o) => o.rotina.id))], dataIso(hoje)).catch(() => [])
  return ocs.map((o) => {
    const g = feitoPor(o, registros, o.rotina.cada_um ? usuarioId : undefined)
    return {
      id: o.chave, origem: 'rotina' as const, titulo: o.rotina.titulo, prazo: new Date(prazoDe(o)).toISOString(), prioridade: 'comum' as Prioridade,
      concluida: !!g, concluida_em: g?.feito_em ?? null, cliente_id: o.rotina.cliente_id, detalhe: `Rotina · ${descreverRepeticao(o.rotina)}`,
      ocorrencia: o, registroId: g?.id,
    }
  })
}

// ---------------------------------------------------------------- Meu Kanban (tarefas pessoais por status)
/** Tarefas pessoais para o Meu Kanban: as abertas e as concluídas nos últimos 14 dias. */
export async function listarTarefasPessoais(): Promise<Tarefa[]> {
  await gerarRotinasPessoais()
  const limite = new Date(Date.now() - 14 * 86_400_000).toISOString()
  if (!supabase) return tarefasDemo.filter((t) => t.status !== 'cancelada' && (t.status !== 'concluida' || (t.concluida_em ?? '') >= limite))
  const { data, error } = await supabase.from('tarefas').select('*').neq('status', 'cancelada').or(`status.neq.concluida,concluida_em.gte.${limite}`).order('prazo', { nullsFirst: false })
  if (error) throw error
  return data as Tarefa[]
}

// ---------------------------------------------------------------- Minha rotina (gera tarefas pessoais)
export type RotinaPessoal = {
  id: string; titulo: string; descricao: string | null; repeticao: 'semana' | 'mes'; dias_semana: number[]; dia_mes: number | null
  horario: string | null; prioridade: Prioridade; ativa: boolean; inicio: string; criado_em: string
}
export type EdicaoRotinaPessoal = Partial<Pick<RotinaPessoal, 'titulo' | 'descricao' | 'repeticao' | 'dias_semana' | 'dia_mes' | 'horario' | 'prioridade' | 'ativa'>>
export const DIAS_GERADOS = 14
const hojeLocal = () => dataIso(new Date())
let rotinasDemo: RotinaPessoal[] = [
  { id: 'rp1', titulo: 'Conferir a caixa de entrada e responder e-mails', descricao: null, repeticao: 'semana', dias_semana: [1, 2, 3, 4, 5], dia_mes: null, horario: '08:30', prioridade: 'comum', ativa: true, inicio: '2026-11-01', criado_em: em(-200) },
  { id: 'rp2', titulo: 'Planejar a semana no Kanban', descricao: 'Revisar o que ficou da semana passada e separar as prioridades', repeticao: 'semana', dias_semana: [1], dia_mes: null, horario: '09:00', prioridade: 'alta', ativa: true, inicio: '2026-11-01', criado_em: em(-200) },
  { id: 'rp3', titulo: 'Atualizar o relatório de métricas', descricao: null, repeticao: 'mes', dias_semana: [], dia_mes: 1, horario: '10:00', prioridade: 'comum', ativa: true, inicio: '2026-11-01', criado_em: em(-200) },
]

/** Dias em que a rotina acontece entre duas datas (inclusive). */
export function diasDaRotina(r: Pick<RotinaPessoal, 'repeticao' | 'dias_semana' | 'dia_mes' | 'inicio' | 'ativa'>, de: Date, ate: Date): Date[] {
  if (!r.ativa) return []
  const dias: Date[] = []
  for (let d = new Date(de.getFullYear(), de.getMonth(), de.getDate()); d <= ate; d.setDate(d.getDate() + 1)) {
    if (dataIso(d) < r.inicio) continue
    if (r.repeticao === 'semana' ? r.dias_semana.includes(d.getDay()) : d.getDate() === Math.min(r.dia_mes ?? 1, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())) dias.push(new Date(d))
  }
  return dias
}
const prazoDaRotina = (r: RotinaPessoal, dia: Date) => { const [h, m] = (r.horario ?? '23:59').split(':').map(Number); return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, m).toISOString() }

let ultimaGeracao = 0
/** Cria as tarefas das rotinas para os próximos 14 dias (sem duplicar). Chamado ao abrir as telas do Meu espaço. */
export async function gerarRotinasPessoais(forcar = false) {
  if (!forcar && Date.now() - ultimaGeracao < 60_000) return
  ultimaGeracao = Date.now()
  if (!supabase) {
    const hoje = new Date(); const ate = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + DIAS_GERADOS - 1)
    rotinasDemo.forEach((r) => diasDaRotina(r, hoje, ate).forEach((d) => {
      const dia = dataIso(d)
      if (tarefasDemo.some((t) => t.rotina_pessoal_id === r.id && t.rotina_data === dia)) return
      tarefasDemo.push({ id: crypto.randomUUID(), titulo: r.titulo, descricao: r.descricao, prazo: prazoDaRotina(r, d), prioridade: r.prioridade, status: 'a_fazer', concluida_em: null, criado_em: new Date().toISOString(), rotina_pessoal_id: r.id, rotina_data: dia })
    }))
    return
  }
  await supabase.rpc('gerar_rotinas_pessoais', { p_dias: DIAS_GERADOS, p_fuso: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo' })
}

export async function listarRotinasPessoais(): Promise<RotinaPessoal[]> {
  if (!supabase) return [...rotinasDemo]
  const { data, error } = await supabase.from('rotinas_pessoais').select('*').order('criado_em')
  if (error) throw error
  return (data as RotinaPessoal[]).map((r) => ({ ...r, horario: r.horario ? r.horario.slice(0, 5) : null }))
}

/** Tira as tarefas futuras ainda não começadas (para regerar com o horário/dias novos). As já feitas ficam no histórico. */
async function limparFuturas(rotinaId: string) {
  if (!supabase) { tarefasDemo = tarefasDemo.filter((t) => !(t.rotina_pessoal_id === rotinaId && (t.rotina_data ?? '') > hojeLocal() && t.status === 'a_fazer')); return }
  await supabase.from('tarefas').delete().eq('rotina_pessoal_id', rotinaId).gt('rotina_data', hojeLocal()).eq('status', 'a_fazer')
}

export async function salvarRotinaPessoal(id: string | null, dados: EdicaoRotinaPessoal) {
  if (!supabase) {
    if (id) rotinasDemo = rotinasDemo.map((r) => (r.id === id ? { ...r, ...dados } : r))
    else rotinasDemo = [...rotinasDemo, { id: crypto.randomUUID(), titulo: '', descricao: null, repeticao: 'semana', dias_semana: [1, 2, 3, 4, 5], dia_mes: null, horario: null, prioridade: 'comum', ativa: true, inicio: hojeLocal(), criado_em: new Date().toISOString(), ...dados }]
  } else if (id) {
    const { error } = await supabase.from('rotinas_pessoais').update(dados).eq('id', id); if (error) throw error
  } else {
    const { error } = await supabase.from('rotinas_pessoais').insert(dados); if (error) throw error
  }
  if (id) await limparFuturas(id)
  await gerarRotinasPessoais(true)
}

export async function excluirRotinaPessoal(id: string) {
  await limparFuturas(id)
  if (!supabase) { rotinasDemo = rotinasDemo.filter((r) => r.id !== id); tarefasDemo = tarefasDemo.map((t) => (t.rotina_pessoal_id === id ? { ...t, rotina_pessoal_id: null } : t)); return }
  const { error } = await supabase.from('rotinas_pessoais').delete().eq('id', id)
  if (error) throw error
}

/** Quantas vezes a rotina foi feita nos últimos dias (para mostrar a constância). */
export async function historicoRotinas(dias = 14): Promise<Tarefa[]> {
  const de = dataIso(new Date(Date.now() - dias * 86_400_000))
  if (!supabase) return tarefasDemo.filter((t) => t.rotina_pessoal_id && (t.rotina_data ?? '') >= de)
  const { data } = await supabase.from('tarefas').select('*').not('rotina_pessoal_id', 'is', null).gte('rotina_data', de)
  return (data ?? []) as Tarefa[]
}

/** Para listas do dia a dia: tarefas da rotina só aparecem hoje e amanhã (as passadas não feitas não viram "atrasadas"). */
export function semRotinaFora(itens: MeuItem[], agora = new Date()): MeuItem[] {
  const hoje = dataIso(agora)
  const amanha = dataIso(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1))
  return itens.filter((i) => {
    if (!i.rotinaPessoal || !i.prazo) return true
    const dia = dataIso(new Date(i.prazo))
    return dia === hoje || dia === amanha || (i.concluida && dia < hoje)
  })
}
