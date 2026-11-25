import { supabase } from './supabase'

export type Etapa = 'prospeccao' | 'primeiro_contato' | 'reuniao' | 'proposta' | 'parceira_ativa' | 'pausada' | 'encerrada'
export type TipoInteracao = 'contato' | 'reuniao' | 'brinde' | 'evento' | 'coleta_leads' | 'campanha' | 'proposta' | 'outro'
export type SituacaoEvento = 'planejado' | 'confirmado' | 'realizado' | 'cancelado'

export const ETAPAS: { id: Etapa; nome: string; cor: string }[] = [
  { id: 'prospeccao', nome: 'Prospecção', cor: 'var(--texto-3)' },
  { id: 'primeiro_contato', nome: 'Primeiro contato', cor: 'var(--info)' },
  { id: 'reuniao', nome: 'Reunião', cor: 'var(--marca-clara)' },
  { id: 'proposta', nome: 'Proposta', cor: 'var(--alerta)' },
  { id: 'parceira_ativa', nome: 'Parceira ativa', cor: 'var(--sucesso)' },
  { id: 'pausada', nome: 'Pausada', cor: 'var(--marca-forte)' },
  { id: 'encerrada', nome: 'Encerrada', cor: 'var(--perigo)' },
]
export const nomeEtapa = (e: Etapa) => ETAPAS.find((x) => x.id === e)?.nome ?? e

export const TIPOS_INTERACAO: { id: TipoInteracao; nome: string }[] = [
  { id: 'contato', nome: 'Contato' }, { id: 'reuniao', nome: 'Reunião' }, { id: 'brinde', nome: 'Entrega de brindes' },
  { id: 'evento', nome: 'Evento' }, { id: 'coleta_leads', nome: 'Coleta de leads' }, { id: 'campanha', nome: 'Campanha' },
  { id: 'proposta', nome: 'Proposta' }, { id: 'outro', nome: 'Outro' },
]
export const nomeTipo = (t: TipoInteracao) => TIPOS_INTERACAO.find((x) => x.id === t)?.nome ?? t

export const SITUACOES_EVENTO: { id: SituacaoEvento; nome: string }[] = [
  { id: 'planejado', nome: 'Planejado' }, { id: 'confirmado', nome: 'Confirmado' },
  { id: 'realizado', nome: 'Realizado' }, { id: 'cancelado', nome: 'Cancelado' },
]

export const CONVENIOS_SUGERIDOS = ['Unimed', 'Bradesco Saúde', 'SulAmérica', 'Amil', 'Hapvida', 'NotreDame Intermédica', 'Porto Saúde', 'Cassi', 'Geap', 'Particular']

export type Empresa = {
  id: string; cliente_id: string; nome: string; cnpj: string | null; segmento: string | null; funcionarios: number | null
  endereco: string | null; site: string | null; convenios: string[]; etapa: Etapa; posicao: number
  proximo_passo: string | null; proximo_passo_em: string | null; observacoes: string | null; atualizado_em: string
}
export type Resumo = { empresa_id: string; ultima_interacao: string | null; ultima_descricao: string | null; total_interacoes: number; total_leads: number | null }
export type Contato = { id: string; empresa_id: string; nome: string; cargo: string | null; email: string | null; telefone: string | null; principal: boolean }
export type Interacao = { id: string; empresa_id: string; tipo: TipoInteracao; titulo: string; descricao: string | null; data: string; autor_id: string; criado_em: string; autor?: string }
export type Evento = {
  id: string; cliente_id: string; empresa_id: string | null; nome: string; data: string; hora: string | null
  local: string | null; descricao: string | null; situacao: SituacaoEvento
}

// ---------------------------------------------------------------- modo demonstração
const hoje = new Date()
const dia = (d: number) => new Date(hoje.getTime() + d * 86_400_000).toISOString().slice(0, 10)
const demo = {
  empresas: [
    { id: 'e1', nome: 'Empresa X', segmento: 'Indústria', funcionarios: 420, convenios: ['Unimed', 'Bradesco Saúde'], etapa: 'parceira_ativa', proximo_passo: 'Levar o mutirão de glicemia', proximo_passo_em: dia(5) },
    { id: 'e2', nome: 'Transportadora Cerrado', segmento: 'Logística', funcionarios: 180, convenios: ['Hapvida'], etapa: 'proposta', proximo_passo: 'Enviar proposta de palestras', proximo_passo_em: dia(2) },
    { id: 'e3', nome: 'Banco Central do Planalto', segmento: 'Financeiro', funcionarios: 900, convenios: ['Cassi', 'SulAmérica'], etapa: 'reuniao', proximo_passo: 'Reunião com o RH', proximo_passo_em: dia(8) },
    { id: 'e4', nome: 'Supermercados Bom Preço', segmento: 'Varejo', funcionarios: 650, convenios: ['Amil'], etapa: 'primeiro_contato', proximo_passo: null, proximo_passo_em: null },
    { id: 'e5', nome: 'Colégio Horizonte', segmento: 'Educação', funcionarios: 120, convenios: ['Unimed'], etapa: 'prospeccao', proximo_passo: 'Descobrir contato do RH', proximo_passo_em: null },
  ].map((e, i) => ({ cliente_id: 'hospital', cnpj: null, endereco: null, site: null, observacoes: null, posicao: i, atualizado_em: hoje.toISOString(), ...e })) as Empresa[],
  contatos: [{ id: 'c1', empresa_id: 'e1', nome: 'Ana Ribeiro', cargo: 'Gerente de RH', email: 'rh@empresax.com.br', telefone: '(61) 3333-1000', principal: true }] as Contato[],
  interacoes: [
    { id: 'i1', empresa_id: 'e1', tipo: 'coleta_leads', titulo: 'QR do Dia do Homem no refeitório: 23 leads', descricao: null, data: dia(-3) },
    { id: 'i2', empresa_id: 'e1', tipo: 'brinde', titulo: 'Entrega de 50 kits Novembro Azul', descricao: 'Squeeze, folder e chaveiro.', data: dia(-10) },
    { id: 'i3', empresa_id: 'e1', tipo: 'reuniao', titulo: 'Reunião com o RH para fechar a parceria', descricao: null, data: dia(-40) },
    { id: 'i4', empresa_id: 'e2', tipo: 'contato', titulo: 'Ligação para o RH apresentando o hospital', descricao: null, data: dia(-6) },
  ].map((i) => ({ autor_id: 'demo', autor: 'Kiara', criado_em: hoje.toISOString(), ...i })) as Interacao[],
  eventos: [
    { id: 'v1', empresa_id: 'e1', nome: 'Mutirão de glicemia na Empresa X', data: dia(5), hora: '08:00', local: 'Refeitório da Empresa X', situacao: 'confirmado' },
    { id: 'v2', empresa_id: 'e3', nome: 'Palestra: saúde do coração', data: dia(12), hora: '10:00', local: 'Auditório do banco', situacao: 'planejado' },
    { id: 'v3', empresa_id: 'e1', nome: 'Dia do Homem: coleta de leads', data: dia(-3), hora: '11:00', local: 'Refeitório', situacao: 'realizado' },
  ].map((v) => ({ cliente_id: 'hospital', descricao: null, ...v })) as Evento[],
}

const uid = () => crypto.randomUUID()

// ---------------------------------------------------------------- empresas
export async function listarEmpresas(clienteId: string): Promise<{ empresas: Empresa[]; resumos: Map<string, Resumo> }> {
  if (!supabase) {
    const resumos = new Map(demo.empresas.map((e) => {
      const is = demo.interacoes.filter((i) => i.empresa_id === e.id).sort((a, b) => b.data.localeCompare(a.data))
      return [e.id, { empresa_id: e.id, ultima_interacao: is[0]?.data ?? null, ultima_descricao: is[0]?.titulo ?? null, total_interacoes: is.length, total_leads: e.id === 'e1' ? 23 : 0 }]
    }))
    return { empresas: [...demo.empresas], resumos }
  }
  const [e, r] = await Promise.all([
    supabase.from('empresas').select('*').eq('cliente_id', clienteId).order('posicao'),
    supabase.rpc('resumo_empresas', { p_cliente: clienteId }),
  ])
  if (e.error) throw e.error
  return { empresas: e.data as Empresa[], resumos: new Map(((r.data ?? []) as Resumo[]).map((x) => [x.empresa_id, x])) }
}

export async function obterEmpresa(id: string) {
  if (!supabase) {
    const empresa = demo.empresas.find((e) => e.id === id) ?? null
    return { empresa, contatos: demo.contatos.filter((c) => c.empresa_id === id),
      interacoes: demo.interacoes.filter((i) => i.empresa_id === id).sort((a, b) => b.data.localeCompare(a.data)),
      eventos: demo.eventos.filter((v) => v.empresa_id === id) }
  }
  const [e, c, i, v] = await Promise.all([
    supabase.from('empresas').select('*').eq('id', id).maybeSingle(),
    supabase.from('contatos_empresa').select('*').eq('empresa_id', id).order('principal', { ascending: false }),
    supabase.from('interacoes').select('*').eq('empresa_id', id).order('data', { ascending: false }).order('criado_em', { ascending: false }),
    supabase.from('eventos').select('*').eq('empresa_id', id).order('data', { ascending: false }),
  ])
  if (e.error) throw e.error
  const interacoes = (i.data ?? []) as Interacao[]
  const autores = [...new Set(interacoes.map((x) => x.autor_id))]
  if (autores.length) {
    const p = await supabase.from('perfis').select('id, nome').in('id', autores)
    const nomes = new Map((p.data ?? []).map((x: { id: string; nome: string }) => [x.id, x.nome]))
    interacoes.forEach((x) => { x.autor = nomes.get(x.autor_id) })
  }
  return { empresa: e.data as Empresa | null, contatos: (c.data ?? []) as Contato[], interacoes, eventos: (v.data ?? []) as Evento[] }
}

export type EdicaoEmpresa = Partial<Omit<Empresa, 'id' | 'cliente_id' | 'atualizado_em'>>

export async function criarEmpresa(clienteId: string, dados: EdicaoEmpresa & { nome: string }) {
  if (!supabase) {
    const nova = { id: uid(), cliente_id: clienteId, cnpj: null, segmento: null, funcionarios: null, endereco: null, site: null, convenios: [], etapa: 'prospeccao', posicao: demo.empresas.length, proximo_passo: null, proximo_passo_em: null, observacoes: null, atualizado_em: new Date().toISOString(), ...dados } as Empresa
    demo.empresas.push(nova); return nova.id
  }
  const { data, error } = await supabase.from('empresas').insert({ cliente_id: clienteId, ...dados }).select('id').single()
  if (error) throw error
  return data.id as string
}

export async function salvarEmpresa(id: string, dados: EdicaoEmpresa) {
  if (!supabase) {
    const e = demo.empresas.find((x) => x.id === id)
    if (e) {
      if (dados.etapa && dados.etapa !== e.etapa) demo.interacoes.unshift({ id: uid(), empresa_id: id, tipo: 'outro', titulo: `Etapa da parceria: ${nomeEtapa(e.etapa)} → ${nomeEtapa(dados.etapa)}`, descricao: null, data: new Date().toISOString().slice(0, 10), autor_id: 'demo', autor: 'Você', criado_em: new Date().toISOString() })
      Object.assign(e, dados)
    }
    return
  }
  const { error } = await supabase.from('empresas').update(dados).eq('id', id)
  if (error) throw error
}

export async function excluirEmpresa(id: string) {
  if (!supabase) { demo.empresas = demo.empresas.filter((e) => e.id !== id); return }
  const { error } = await supabase.from('empresas').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------- contatos e histórico
export async function adicionarContato(c: Omit<Contato, 'id'>) {
  if (!supabase) { demo.contatos.push({ ...c, id: uid() }); return }
  const { error } = await supabase.from('contatos_empresa').insert(c)
  if (error) throw error
}
export async function removerContato(id: string) {
  if (!supabase) { demo.contatos = demo.contatos.filter((c) => c.id !== id); return }
  await supabase.from('contatos_empresa').delete().eq('id', id)
}

export async function registrarInteracao(i: { empresa_id: string; tipo: TipoInteracao; titulo: string; descricao: string | null; data: string }) {
  if (!supabase) { demo.interacoes.unshift({ ...i, id: uid(), autor_id: 'demo', autor: 'Você', criado_em: new Date().toISOString() }); return }
  const { error } = await supabase.from('interacoes').insert(i)
  if (error) throw error
}
export async function excluirInteracao(id: string) {
  if (!supabase) { demo.interacoes = demo.interacoes.filter((i) => i.id !== id); return }
  await supabase.from('interacoes').delete().eq('id', id)
}

// ---------------------------------------------------------------- eventos
export async function listarEventos(clienteId: string): Promise<Evento[]> {
  if (!supabase) return [...demo.eventos].sort((a, b) => a.data.localeCompare(b.data))
  const { data, error } = await supabase.from('eventos').select('*').eq('cliente_id', clienteId).order('data')
  if (error) throw error
  return data as Evento[]
}
export async function salvarEvento(clienteId: string, ev: Omit<Evento, 'id' | 'cliente_id'> & { id?: string }) {
  const { id, ...dados } = ev
  if (!supabase) {
    if (id) Object.assign(demo.eventos.find((x) => x.id === id) ?? {}, dados)
    else demo.eventos.push({ ...dados, id: uid(), cliente_id: clienteId })
    return
  }
  const r = id ? await supabase.from('eventos').update(dados).eq('id', id) : await supabase.from('eventos').insert({ ...dados, cliente_id: clienteId })
  if (r.error) throw r.error
}

export const dataBr = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')
export const hojeIso = () => new Date().toISOString().slice(0, 10)

// ---------------------------------------------------------------- ajudas para a tela
/** As 5 etapas do caminho normal (Pausada e Encerrada ficam fora da trilha). */
export const TRILHA: Etapa[] = ['prospeccao', 'primeiro_contato', 'reuniao', 'proposta', 'parceira_ativa']
export const corEtapa = (e: Etapa) => ETAPAS.find((x) => x.id === e)?.cor ?? 'var(--texto-3)'

const meioDia = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).getTime()
/** Dias desde a data (0 = hoje). */
export const diasDesde = (iso: string) => Math.round((meioDia(hojeIso()) - meioDia(iso)) / 86_400_000)

/** "hoje", "ontem", "há 5 dias", "há 2 meses" */
export function haQuanto(iso: string) {
  const d = diasDesde(iso)
  if (d <= 0) return 'hoje'
  if (d === 1) return 'ontem'
  if (d < 45) return `há ${d} dias`
  return `há ${Math.round(d / 30)} meses`
}
/** Prazo do próximo passo: atrasado, hoje, amanhã, em X dias. */
export function prazo(iso: string): { texto: string; tom: 'perigo' | 'alerta' | 'neutro' } {
  const d = -diasDesde(iso)
  if (d < 0) return { texto: d === -1 ? 'atrasado 1 dia' : `atrasado ${-d} dias`, tom: 'perigo' }
  if (d === 0) return { texto: 'hoje', tom: 'alerta' }
  if (d === 1) return { texto: 'amanhã', tom: 'alerta' }
  return { texto: `em ${d} dias`, tom: 'neutro' }
}
/** Sem nenhum registro há mais de 30 dias em etapas que ainda estão andando. */
export const DIAS_ESFRIANDO = 30
export function esfriando(e: Empresa, ultima: string | null | undefined) {
  if (e.etapa === 'pausada' || e.etapa === 'encerrada') return false
  return !ultima || diasDesde(ultima) > DIAS_ESFRIANDO
}

/** Que etapa um registro sugere (ex.: registrou reunião numa empresa em "Primeiro contato" → sugere "Reunião"). */
export function etapaSugerida(atual: Etapa, tipo: TipoInteracao): Etapa | null {
  const alvo: Partial<Record<TipoInteracao, Etapa>> = { contato: 'primeiro_contato', reuniao: 'reuniao', proposta: 'proposta' }
  const e = alvo[tipo]
  if (!e) return null
  const i = TRILHA.indexOf(atual)
  if (atual === 'encerrada' || (i >= 0 && TRILHA.indexOf(e) <= i)) return null
  return e
}

export const somarDias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
