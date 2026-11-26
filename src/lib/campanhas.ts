import { supabase } from './supabase'

// ---------------------------------------------------------------- tipos
export type ModoCampo = 'obrigatorio' | 'exibir' | 'oculto'
export type TipoCampo = 'texto' | 'telefone' | 'email' | 'data' | 'numero' | 'escolha' | 'sim_nao' | 'convenio'
export type Campo = {
  chave: string; rotulo: string; tipo: TipoCampo; modo: ModoCampo
  valor_fixo?: string; opcoes?: string[]; segmento?: string
  /** Plano de saúde: logo de cada opção, para o público tocar no logo. */
  fotos?: Record<string, string>
}
export type SituacaoCampanha = 'rascunho' | 'ativa' | 'encerrada'
export type Campanha = {
  id: string; cliente_id: string; nome: string; inicio: string | null; fim: string | null; situacao: SituacaoCampanha
  formulario: Campo[]; titulo_publico: string | null; texto_publico: string | null; mensagem_obrigado: string
  empresa_id: string | null; evento_id: string | null; criado_em: string
}
export type ResumoCampanha = { campanha_id: string; leituras: number; total_leads: number; leads_7_dias: number; convertidos: number }
export type Peca = { id: string; campanha_id: string; nome: string; slug: string; leituras: number; criado_em: string; total_leads?: number }

export type EtapaLead = 'novo' | 'em_contato' | 'agendado' | 'convertido' | 'perdido'
export type Lead = {
  id: string; cliente_id: string; campanha_id: string | null; peca_id: string | null; nome: string; whatsapp: string | null; email: string | null
  dados: Record<string, string>; segmentos: string[]; etapa: EtapaLead; motivo_perda: string | null; proxima_acao: string | null
  proxima_acao_em: string | null; aceite_contato_em: string; aceite_campanhas_em: string | null; descadastrado_em: string | null; criado_em: string
}
export type EventoLead = { id: number; lead_id: string; autor_id: string | null; tipo: string; detalhe: Record<string, string | null>; criado_em: string; autor?: string }

export const ETAPAS_LEAD: { id: EtapaLead; nome: string; cor: string }[] = [
  { id: 'novo', nome: 'Novo', cor: 'var(--info)' },
  { id: 'em_contato', nome: 'Em contato', cor: 'var(--marca)' },
  { id: 'agendado', nome: 'Agendado', cor: 'var(--alerta)' },
  { id: 'convertido', nome: 'Convertido', cor: 'var(--sucesso)' },
  { id: 'perdido', nome: 'Perdido', cor: 'var(--perigo)' },
]
export const nomeEtapaLead = (e: EtapaLead) => ETAPAS_LEAD.find((x) => x.id === e)?.nome ?? e
export const MOTIVOS_PERDA = ['Não atende', 'Sem interesse', 'Já é paciente', 'Plano não coberto', 'Número errado']

export const TIPOS_CAMPO: { id: TipoCampo; nome: string }[] = [
  { id: 'texto', nome: 'Texto' }, { id: 'telefone', nome: 'Telefone' }, { id: 'email', nome: 'E-mail' }, { id: 'numero', nome: 'Número' },
  { id: 'data', nome: 'Data' }, { id: 'escolha', nome: 'Escolha' }, { id: 'sim_nao', nome: 'Sim ou não' }, { id: 'convenio', nome: 'Plano de saúde (logos)' },
]

/** Campos prontos para adicionar com um clique. */
export const CAMPOS_PRONTOS: (Campo & { dica: string })[] = [
  { chave: 'email', rotulo: 'E-mail', tipo: 'email', modo: 'exibir', dica: 'E-mail' },
  { chave: 'convenio', rotulo: 'Qual o seu plano de saúde?', tipo: 'convenio', modo: 'exibir', dica: 'Plano de saúde' },
  { chave: 'idade', rotulo: 'Idade', tipo: 'numero', modo: 'exibir', dica: 'Idade' },
  { chave: 'bairro', rotulo: 'Bairro', tipo: 'texto', modo: 'exibir', dica: 'Bairro' },
  { chave: 'empresa', rotulo: 'Empresa onde trabalha', tipo: 'texto', modo: 'exibir', dica: 'Empresa' },
  { chave: 'diabetes', rotulo: 'Tem diabetes ou histórico na família?', tipo: 'sim_nao', modo: 'exibir', segmento: 'Risco de diabetes', dica: 'Diabetes?' },
  { chave: 'pressao', rotulo: 'Tem pressão alta?', tipo: 'sim_nao', modo: 'exibir', segmento: 'Hipertensão', dica: 'Pressão alta?' },
  { chave: 'interesse', rotulo: 'Interesse', tipo: 'escolha', modo: 'exibir', opcoes: ['Check-up', 'Consulta', 'Exames'], dica: 'Interesse' },
]

export const CAMPOS_BASE: Campo[] = [
  { chave: 'nome', rotulo: 'Nome completo', tipo: 'texto', modo: 'obrigatorio' },
  { chave: 'whatsapp', rotulo: 'WhatsApp', tipo: 'telefone', modo: 'obrigatorio' },
]

export const slugify = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
export const chaveDe = (rotulo: string) => slugify(rotulo).replace(/-/g, '_') || `campo_${Date.now().toString(36)}`
export const linkPeca = (slug: string) => `${window.location.origin}/q/${slug}`
/** "61 99999-0000" → "5561999990000" para o wa.me */
export const numeroWhats = (t: string | null) => { const d = (t ?? '').replace(/\D/g, ''); return d.length >= 10 && !d.startsWith('55') ? `55${d}` : d }

// ---------------------------------------------------------------- modo demonstração
const agora = Date.now()
const haDias = (d: number, h = 0) => new Date(agora - d * 86_400_000 - h * 3_600_000).toISOString()
const demoCampanhas: Campanha[] = [
  {
    id: 'c1', cliente_id: 'hospital', nome: 'Dia do Homem na Empresa X', inicio: haDias(10).slice(0, 10), fim: null, situacao: 'ativa',
    formulario: [...CAMPOS_BASE, { chave: 'convenio', rotulo: 'Plano de saúde', tipo: 'texto', modo: 'oculto', valor_fixo: 'Unimed (Empresa X)' },
      { chave: 'diabetes', rotulo: 'Tem diabetes ou histórico na família?', tipo: 'sim_nao', modo: 'exibir', segmento: 'Risco de diabetes' },
      { chave: 'interesse', rotulo: 'Interesse', tipo: 'escolha', modo: 'exibir', opcoes: ['Check-up masculino', 'Urologia', 'Cardiologia'] }],
    titulo_publico: 'Dia do Homem 2026', texto_publico: 'Garanta seu check-up com condições especiais para quem trabalha na Empresa X.',
    mensagem_obrigado: 'Recebemos! Nossa equipe fala com você pelo WhatsApp em até 1 dia útil.', empresa_id: 'e1', evento_id: 'v3', criado_em: haDias(12),
  },
  {
    id: 'c2', cliente_id: 'hospital', nome: 'Mutirão de glicemia', inicio: null, fim: null, situacao: 'rascunho',
    formulario: [...CAMPOS_BASE, { chave: 'diabetes', rotulo: 'Tem diabetes ou histórico na família?', tipo: 'sim_nao', modo: 'exibir', segmento: 'Risco de diabetes' }],
    titulo_publico: null, texto_publico: null, mensagem_obrigado: 'Obrigado! Nossa equipe vai entrar em contato.', empresa_id: 'e1', evento_id: 'v1', criado_em: haDias(2),
  },
  {
    id: 'c3', cliente_id: 'hospital', nome: 'Outubro Rosa 2026', inicio: haDias(55).slice(0, 10), fim: haDias(25).slice(0, 10), situacao: 'encerrada',
    formulario: [...CAMPOS_BASE], titulo_publico: 'Outubro Rosa', texto_publico: null, mensagem_obrigado: 'Obrigado!', empresa_id: null, evento_id: null, criado_em: haDias(60),
  },
]
let demoPecas: Peca[] = [
  { id: 'p1', campanha_id: 'c1', nome: 'Cartaz do refeitório', slug: 'dia-do-homem-ref1', leituras: 64, criado_em: haDias(10), total_leads: 17 },
  { id: 'p2', campanha_id: 'c1', nome: 'Folder na recepção', slug: 'dia-do-homem-fold', leituras: 22, criado_em: haDias(10), total_leads: 6 },
  { id: 'p3', campanha_id: 'c3', nome: 'Banner', slug: 'outubro-rosa-bnr1', leituras: 130, criado_em: haDias(55), total_leads: 3 },
]
const nomes = ['Carlos Mendes', 'João Pereira', 'Marcos Lima', 'Rafael Souza', 'Antônio Silva', 'Paulo Rocha', 'Ricardo Alves', 'Bruno Costa', 'Ana Paula Reis', 'Fernanda Dias']
let demoLeads: Lead[] = nomes.map((nome, i) => ({
  id: `l${i}`, cliente_id: 'hospital', campanha_id: i < 8 ? 'c1' : 'c3', peca_id: i < 6 ? 'p1' : i < 8 ? 'p2' : 'p3', nome,
  whatsapp: `(61) 9${8000 + i * 37}-${1000 + i * 113}`, email: i % 3 === 0 ? `${slugify(nome).split('-')[0]}@exemplo.com` : null,
  dados: { convenio: i < 8 ? 'Unimed (Empresa X)' : 'Particular', ...(i < 8 ? { diabetes: i % 2 ? 'Sim' : 'Não', interesse: ['Check-up masculino', 'Urologia', 'Cardiologia'][i % 3] } : {}) },
  segmentos: i < 8 && i % 2 ? ['Risco de diabetes'] : [],
  etapa: (['novo', 'novo', 'em_contato', 'agendado', 'convertido', 'novo', 'em_contato', 'perdido', 'convertido', 'novo'] as EtapaLead[])[i],
  motivo_perda: i === 7 ? 'Sem interesse' : null, proxima_acao: i === 2 ? 'Ligar de novo' : null, proxima_acao_em: null,
  aceite_contato_em: haDias(i), aceite_campanhas_em: i % 4 === 3 ? null : haDias(i), descadastrado_em: null, criado_em: haDias(i * 1.3, i),
}))
const demoEventos: EventoLead[] = []

const uid = () => crypto.randomUUID()

// ---------------------------------------------------------------- campanhas
export async function listarCampanhas(clienteId: string): Promise<{ campanhas: Campanha[]; resumos: Map<string, ResumoCampanha> }> {
  if (!supabase) {
    const resumos = new Map(demoCampanhas.map((c) => {
      const ls = demoLeads.filter((l) => l.campanha_id === c.id)
      return [c.id, { campanha_id: c.id, leituras: demoPecas.filter((p) => p.campanha_id === c.id).reduce((s, p) => s + p.leituras, 0),
        total_leads: c.id === 'c1' ? 23 : ls.length, leads_7_dias: c.id === 'c1' ? 9 : 0, convertidos: ls.filter((l) => l.etapa === 'convertido').length }]
    }))
    return { campanhas: [...demoCampanhas].sort((a, b) => b.criado_em.localeCompare(a.criado_em)), resumos }
  }
  const [c, r] = await Promise.all([
    supabase.from('campanhas').select('*').eq('cliente_id', clienteId).order('criado_em', { ascending: false }),
    supabase.rpc('resumo_campanhas', { p_cliente: clienteId }),
  ])
  if (c.error) throw c.error
  return { campanhas: c.data as Campanha[], resumos: new Map(((r.data ?? []) as ResumoCampanha[]).map((x) => [x.campanha_id, { ...x, leituras: Number(x.leituras), total_leads: Number(x.total_leads), leads_7_dias: Number(x.leads_7_dias), convertidos: Number(x.convertidos) }])) }
}

export async function obterCampanha(id: string): Promise<{ campanha: Campanha | null; pecas: Peca[] }> {
  if (!supabase) return { campanha: demoCampanhas.find((c) => c.id === id) ?? null, pecas: demoPecas.filter((p) => p.campanha_id === id) }
  const [c, p, r] = await Promise.all([
    supabase.from('campanhas').select('*').eq('id', id).maybeSingle(),
    supabase.from('pecas_qr').select('*').eq('campanha_id', id).order('criado_em'),
    supabase.rpc('resumo_pecas', { p_campanha: id }),
  ])
  if (c.error) throw c.error
  const leads = new Map(((r.data ?? []) as { peca_id: string; total_leads: number }[]).map((x) => [x.peca_id, Number(x.total_leads)]))
  return { campanha: c.data as Campanha | null, pecas: ((p.data ?? []) as Peca[]).map((x) => ({ ...x, total_leads: leads.get(x.id) ?? 0 })) }
}

export type NovaCampanha = Pick<Campanha, 'nome' | 'empresa_id' | 'evento_id' | 'inicio' | 'fim' | 'formulario'>
export async function criarCampanha(clienteId: string, dados: NovaCampanha): Promise<string> {
  if (!supabase) {
    const id = uid()
    demoCampanhas.push({ ...dados, id, cliente_id: clienteId, situacao: 'rascunho', titulo_publico: null, texto_publico: null, mensagem_obrigado: 'Obrigado! Nossa equipe vai entrar em contato.', criado_em: new Date().toISOString() })
    return id
  }
  const { data, error } = await supabase.from('campanhas').insert({ ...dados, cliente_id: clienteId }).select('id').single()
  if (error) throw error
  return data.id as string
}

export async function salvarCampanha(id: string, dados: Partial<Omit<Campanha, 'id' | 'cliente_id' | 'criado_em'>>) {
  if (!supabase) { Object.assign(demoCampanhas.find((c) => c.id === id) ?? {}, dados); return }
  const { error } = await supabase.from('campanhas').update(dados).eq('id', id)
  if (error) throw error
}

export async function excluirCampanha(id: string) {
  if (!supabase) { const i = demoCampanhas.findIndex((c) => c.id === id); if (i >= 0) demoCampanhas.splice(i, 1); return }
  const { error } = await supabase.from('campanhas').delete().eq('id', id)
  if (error) throw error
}

export async function criarPeca(campanha: Campanha, nome: string) {
  const sufixo = Math.random().toString(36).slice(2, 6)
  const slug = `${slugify(campanha.nome).slice(0, 22)}-${sufixo}`
  if (!supabase) { demoPecas.push({ id: uid(), campanha_id: campanha.id, nome, slug, leituras: 0, criado_em: new Date().toISOString(), total_leads: 0 }); return }
  const { error } = await supabase.from('pecas_qr').insert({ campanha_id: campanha.id, nome, slug })
  if (error) throw error
}

export async function excluirPeca(id: string) {
  if (!supabase) { demoPecas = demoPecas.filter((p) => p.id !== id); return }
  const { error } = await supabase.from('pecas_qr').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------- leads
export async function listarLeads(clienteId: string): Promise<Lead[]> {
  if (!supabase) return [...demoLeads].sort((a, b) => b.criado_em.localeCompare(a.criado_em))
  const { data, error } = await supabase.from('leads').select('*').eq('cliente_id', clienteId).order('criado_em', { ascending: false }).limit(2000)
  if (error) throw error
  return data as Lead[]
}

/** Abre o lead pelo banco, que registra quem abriu e quando (sigilo). */
export async function abrirLead(id: string): Promise<{ lead: Lead | null; eventos: EventoLead[] }> {
  if (!supabase) {
    demoEventos.unshift({ id: Date.now(), lead_id: id, autor_id: 'demo', autor: 'Você', tipo: 'aberto', detalhe: {}, criado_em: new Date().toISOString() })
    return { lead: demoLeads.find((l) => l.id === id) ?? null, eventos: demoEventos.filter((e) => e.lead_id === id) }
  }
  const { data, error } = await supabase.rpc('abrir_lead', { p_lead: id })
  if (error) throw error
  const ev = await supabase.from('eventos_lead').select('*').eq('lead_id', id).order('criado_em', { ascending: false }).limit(100)
  const eventos = (ev.data ?? []) as EventoLead[]
  const autores = [...new Set(eventos.map((e) => e.autor_id).filter(Boolean))] as string[]
  if (autores.length) {
    const p = await supabase.from('perfis').select('id, nome').in('id', autores)
    const nomes = new Map((p.data ?? []).map((x: { id: string; nome: string }) => [x.id, x.nome]))
    eventos.forEach((e) => { if (e.autor_id) e.autor = nomes.get(e.autor_id) })
  }
  return { lead: ((data ?? []) as Lead[])[0] ?? null, eventos }
}

export async function salvarLead(id: string, dados: Partial<Pick<Lead, 'etapa' | 'motivo_perda' | 'proxima_acao' | 'proxima_acao_em' | 'descadastrado_em' | 'segmentos'>>) {
  if (!supabase) {
    const l = demoLeads.find((x) => x.id === id)
    if (l && dados.etapa && dados.etapa !== l.etapa) demoEventos.unshift({ id: Date.now(), lead_id: id, autor_id: 'demo', autor: 'Você', tipo: 'etapa', detalhe: { de: l.etapa, para: dados.etapa, motivo: dados.motivo_perda ?? null }, criado_em: new Date().toISOString() })
    demoLeads = demoLeads.map((x) => (x.id === id ? { ...x, ...dados } : x)); return
  }
  const { error } = await supabase.from('leads').update(dados).eq('id', id)
  if (error) throw error
}

/** Registra no histórico do lead (contato pelo WhatsApp, e-mail, envio de campanha…). */
export async function registrarEventoLead(leadIds: string[], tipo: string, detalhe: Record<string, string> = {}) {
  if (!leadIds.length) return
  if (!supabase) {
    leadIds.forEach((id) => demoEventos.unshift({ id: Date.now() + Math.random(), lead_id: id, autor_id: 'demo', autor: 'Você', tipo, detalhe, criado_em: new Date().toISOString() }))
    return
  }
  const { data: u } = await supabase.auth.getUser()
  const { error } = await supabase.from('eventos_lead').insert(leadIds.map((lead_id) => ({ lead_id, tipo, detalhe, autor_id: u.user?.id })))
  if (error) throw error
}

export async function excluirLead(id: string) {
  if (!supabase) { demoLeads = demoLeads.filter((l) => l.id !== id); return }
  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) throw error
}

/** Quem pode receber campanha em massa: aceitou campanhas e não pediu para sair (LGPD). */
export const podeReceberCampanha = (l: Lead) => !!l.aceite_campanhas_em && !l.descadastrado_em

export function tempoRelativo(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  if (d === 1) return 'ontem'
  if (d < 45) return `há ${d} dias`
  return new Date(iso).toLocaleDateString('pt-BR')
}

export const SEM_PLANO = 'Não tenho / particular'
/** Preenche as opções e os logos dos campos de plano de saúde com os planos cadastrados no cliente. */
export function comPlanos(campos: Campo[], planos: { nome: string; foto_url: string | null }[]): Campo[] {
  return campos.map((c) => (c.tipo !== 'convenio' ? c : {
    ...c,
    opcoes: [...planos.map((p) => p.nome), SEM_PLANO],
    fotos: Object.fromEntries(planos.filter((p) => p.foto_url && !p.foto_url.startsWith('data:')).map((p) => [p.nome, p.foto_url!])),
  }))
}

// ---------------------------------------------------------------- importar planilha
export type LeadImportado = { nome: string; whatsapp: string | null; email: string | null; dados: Record<string, string>; segmentos: string[]; aceita_campanhas: boolean; etapa: EtapaLead | null }
export async function importarLeads(clienteId: string, linhas: LeadImportado[], origem: string): Promise<{ inseridos: number; repetidos: number; invalidos: number }> {
  if (!supabase) {
    let inseridos = 0; let repetidos = 0
    const dig = (t: string | null) => (t ?? '').replace(/\D/g, '').slice(-10)
    for (const l of linhas) {
      if (demoLeads.some((x) => (l.whatsapp && dig(x.whatsapp) === dig(l.whatsapp)) || (l.email && x.email === l.email))) { repetidos++; continue }
      demoLeads.unshift({ id: crypto.randomUUID(), cliente_id: clienteId, campanha_id: null, peca_id: null, nome: l.nome, whatsapp: l.whatsapp, email: l.email, dados: l.dados,
        segmentos: l.segmentos, etapa: l.etapa && l.etapa !== 'perdido' ? l.etapa : 'novo', motivo_perda: null, proxima_acao: null, proxima_acao_em: null,
        aceite_contato_em: new Date().toISOString(), aceite_campanhas_em: l.aceita_campanhas ? new Date().toISOString() : null, descadastrado_em: null, criado_em: new Date().toISOString() })
      inseridos++
    }
    return { inseridos, repetidos, invalidos: 0 }
  }
  const { data, error } = await supabase.rpc('importar_leads', { p_cliente: clienteId, p_linhas: linhas, p_origem: origem })
  if (error) throw new Error(error.code === '42501' ? 'Só administradores importam leads.' : 'Não foi possível importar.')
  return data as { inseridos: number; repetidos: number; invalidos: number }
}
