import { supabase } from './supabase'

/** Reuniões: agenda, pauta, anotações, encaminhamentos (viram tarefa de quem é responsável) e anexos privados. */
export type ItemPauta = { id: string; texto: string; autor: string | null; discutido: boolean }
export type Encaminhamento = { id: string; texto: string; responsavel: string | null; prazo: string | null; feito: boolean; feito_em?: string | null }
export type AnexoReuniao = { id: string; nome: string; caminho: string; mime: string | null; tamanho: number }
export type Recorrencia = 'nenhuma' | 'semanal' | 'quinzenal' | 'mensal'
export type Reuniao = {
  id: string; cliente_id: string; titulo: string; descricao: string | null; inicio: string; duracao_min: number; local: string | null
  participantes: string[]; convidados: string | null; restrita: boolean; recorrencia: Recorrencia; serie_id: string | null
  situacao: 'agendada' | 'realizada' | 'cancelada'; pauta: ItemPauta[]; ata: string | null; encaminhamentos: Encaminhamento[]; anexos: AnexoReuniao[]
  criado_por: string; criado_em: string; atualizado_em: string
}
export type EdicaoReuniao = Partial<Omit<Reuniao, 'id' | 'cliente_id' | 'criado_por' | 'criado_em' | 'atualizado_em'>>

export const RECORRENCIAS: { valor: Recorrencia; rotulo: string }[] = [
  { valor: 'nenhuma', rotulo: 'Não se repete' }, { valor: 'semanal', rotulo: 'Toda semana' }, { valor: 'quinzenal', rotulo: 'A cada 15 dias' }, { valor: 'mensal', rotulo: 'Todo mês' },
]
export const fimDe = (r: Pick<Reuniao, 'inicio' | 'duracao_min'>) => new Date(new Date(r.inicio).getTime() + r.duracao_min * 60_000)
export function proximaData(r: Pick<Reuniao, 'inicio' | 'recorrencia'>): Date | null {
  const d = new Date(r.inicio)
  if (r.recorrencia === 'semanal') return new Date(d.getTime() + 7 * 86_400_000)
  if (r.recorrencia === 'quinzenal') return new Date(d.getTime() + 14 * 86_400_000)
  if (r.recorrencia === 'mensal') { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n }
  return null
}
const novoId = () => crypto.randomUUID()

// ---------------------------------------------------------------- demonstração
const em = (dias: number, h: number, m = 0) => { const d = new Date(); d.setDate(d.getDate() + dias); d.setHours(h, m, 0, 0); return d.toISOString() }
const base = { cliente_id: 'hospital', descricao: null, local: null, convidados: null, restrita: false, recorrencia: 'nenhuma' as Recorrencia, serie_id: null, situacao: 'agendada' as const, pauta: [], ata: null, encaminhamentos: [], anexos: [], criado_por: 'p1', criado_em: em(-10, 9), atualizado_em: em(-1, 9) }
let demo: Reuniao[] = [
  { ...base, id: 'r1', titulo: 'Alinhamento semanal do marketing', descricao: 'O que vai ao ar na semana, pendências e prioridades.', inicio: em(0, 14), duracao_min: 45, local: 'Sala de reuniões do 2º andar',
    participantes: ['p1', 'p2', 'p3', 'p4'], recorrencia: 'semanal', serie_id: 's1',
    pauta: [
      { id: 'a1', texto: 'Posts da campanha Dezembro Vermelho', autor: 'p2', discutido: false },
      { id: 'a2', texto: 'Fotos do evento de Natal: quem cobre?', autor: 'p4', discutido: false },
      { id: 'a3', texto: 'Orçamento dos banners da recepção', autor: 'p1', discutido: false },
    ],
    encaminhamentos: [{ id: 'e1', texto: 'Mandar o cronograma de dezembro para a diretoria', responsavel: 'p1', prazo: em(2, 18).slice(0, 10), feito: false }] },
  { ...base, id: 'r2', titulo: 'Reunião com a diretoria: planejamento 2027', inicio: em(3, 10), duracao_min: 90, local: 'Sala da diretoria', participantes: ['p1', 'p2'], restrita: true,
    convidados: 'Dra. Paula (diretora clínica), Sr. Roberto (financeiro)', pauta: [{ id: 'b1', texto: 'Verba de marketing do 1º trimestre', autor: 'p1', discutido: false }] },
  { ...base, id: 'r3', titulo: 'Briefing do vídeo institucional da UTI', inicio: em(6, 15, 30), duracao_min: 60, local: 'Online', participantes: ['p1', 'p3'], convidados: 'Thiago (Lume Filmes)' },
  { ...base, id: 'r0', titulo: 'Alinhamento semanal do marketing', inicio: em(-7, 14), duracao_min: 45, local: 'Sala de reuniões do 2º andar', participantes: ['p1', 'p2', 'p3', 'p4'], recorrencia: 'semanal', serie_id: 's1', situacao: 'realizada',
    pauta: [{ id: 'c1', texto: 'Resultado do Novembro Azul', autor: 'p1', discutido: true }, { id: 'c2', texto: 'Escala das fotos de fim de ano', autor: 'p3', discutido: true }],
    ata: 'Novembro Azul teve o melhor alcance do ano (Reels do Dia do Homem).\nDecidido: manter 3 posts por semana em dezembro.\nKiara fecha a escala das fotos até sexta.',
    encaminhamentos: [{ id: 'd1', texto: 'Fechar a escala das fotos de fim de ano', responsavel: 'p2', prazo: em(-3, 18).slice(0, 10), feito: true, feito_em: em(-4, 16) }, { id: 'd2', texto: 'Levantar números do Novembro Azul para o relatório', responsavel: 'p1', prazo: em(1, 18).slice(0, 10), feito: false }] },
]
const arquivosDemo = new Map<string, string>()

// ---------------------------------------------------------------- dados
export async function listarReunioes(clienteId: string): Promise<Reuniao[]> {
  if (!supabase) return demo.map((r) => ({ ...r })).sort((a, b) => a.inicio.localeCompare(b.inicio))
  const { data, error } = await supabase.from('reunioes').select('*').eq('cliente_id', clienteId).order('inicio')
  if (error) throw error
  return data as Reuniao[]
}

/** Reuniões em que a pessoa participa (de todos os clientes), para o Calendário e o Início. */
export async function minhasReunioes(usuarioId: string, de: string, ate: string): Promise<Reuniao[]> {
  if (!supabase) return demo.filter((r) => r.situacao !== 'cancelada' && (r.participantes.includes(usuarioId) || r.criado_por === usuarioId) && r.inicio >= de && r.inicio <= ate)
  const { data } = await supabase.from('reunioes').select('*').neq('situacao', 'cancelada').gte('inicio', de).lte('inicio', ate)
    .or(`participantes.cs.{${usuarioId}},criado_por.eq.${usuarioId}`).order('inicio')
  return (data ?? []) as Reuniao[]
}

/** Encaminhamentos em que a pessoa é responsável (aparecem em Minhas tarefas). */
export async function meusEncaminhamentos(usuarioId: string): Promise<{ reuniao: Reuniao; enc: Encaminhamento }[]> {
  const lista = supabase
    ? ((await supabase.from('reunioes').select('*').contains('encaminhamentos', [{ responsavel: usuarioId }])).data ?? []) as Reuniao[]
    : demo
  return lista.flatMap((r) => r.encaminhamentos.filter((e) => e.responsavel === usuarioId).map((enc) => ({ reuniao: r, enc })))
}

export async function salvarReuniao(clienteId: string, id: string | null, dados: EdicaoReuniao): Promise<Reuniao> {
  if (!supabase) {
    if (id) { demo = demo.map((r) => (r.id === id ? { ...r, ...dados, atualizado_em: new Date().toISOString() } : r)); return demo.find((r) => r.id === id)! }
    const nova: Reuniao = { ...base, id: novoId(), titulo: '', inicio: new Date().toISOString(), duracao_min: 60, participantes: [], criado_em: new Date().toISOString(), ...dados } as Reuniao
    demo = [...demo, nova]; return nova
  }
  const q = id ? supabase.from('reunioes').update(dados).eq('id', id) : supabase.from('reunioes').insert({ cliente_id: clienteId, ...dados })
  const { data, error } = await q.select('*').single()
  if (error) throw error
  return data as Reuniao
}

export async function excluirReuniao(r: Reuniao) {
  if (r.anexos.length && supabase) await supabase.storage.from('reunioes').remove(r.anexos.map((a) => a.caminho))
  if (!supabase) { demo = demo.filter((x) => x.id !== r.id); return }
  const { error } = await supabase.from('reunioes').delete().eq('id', r.id)
  if (error) throw error
}

export async function marcarEncaminhamento(reuniaoId: string, encId: string, feito: boolean) {
  if (!supabase) {
    demo = demo.map((r) => (r.id === reuniaoId ? { ...r, encaminhamentos: r.encaminhamentos.map((e) => (e.id === encId ? { ...e, feito, feito_em: feito ? new Date().toISOString() : null } : e)) } : r))
    return
  }
  const { error } = await supabase.rpc('marcar_encaminhamento', { p_reuniao: reuniaoId, p_encaminhamento: encId, p_feito: feito })
  if (error) throw error
}

/** Marca como realizada. Se a reunião se repete, já agenda a próxima levando os pontos de pauta que não foram discutidos. */
export async function concluirReuniao(r: Reuniao): Promise<Reuniao | null> {
  await salvarReuniao(r.cliente_id, r.id, { situacao: 'realizada' })
  const prox = proximaData(r)
  if (!prox) return null
  const serie = r.serie_id ?? r.id
  if (r.serie_id === null) await salvarReuniao(r.cliente_id, r.id, { serie_id: serie })
  const existentes = await listarReunioes(r.cliente_id)
  if (existentes.some((x) => x.serie_id === serie && x.inicio > r.inicio && x.situacao === 'agendada')) return null
  return salvarReuniao(r.cliente_id, null, {
    titulo: r.titulo, descricao: r.descricao, inicio: prox.toISOString(), duracao_min: r.duracao_min, local: r.local, participantes: r.participantes, convidados: r.convidados,
    restrita: r.restrita, recorrencia: r.recorrencia, serie_id: serie, situacao: 'agendada', ata: null, encaminhamentos: [], anexos: [],
    pauta: r.pauta.filter((p) => !p.discutido).map((p) => ({ ...p, id: novoId() })),
  })
}

// ---------------------------------------------------------------- anexos
const nomeSeguro = (n: string) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '-').slice(-60)
export async function enviarAnexo(r: Reuniao, arquivo: File): Promise<AnexoReuniao> {
  if (arquivo.size > 25 * 1024 * 1024) throw new Error(`${arquivo.name}: maior que 25 MB.`)
  const caminho = `${r.cliente_id}/${r.id}/${Date.now()}-${nomeSeguro(arquivo.name)}`
  const anexo: AnexoReuniao = { id: novoId(), nome: arquivo.name, caminho, mime: arquivo.type || null, tamanho: arquivo.size }
  if (!supabase) { arquivosDemo.set(caminho, URL.createObjectURL(arquivo)); return anexo }
  const { error } = await supabase.storage.from('reunioes').upload(caminho, arquivo, { contentType: arquivo.type || undefined })
  if (error) throw new Error(`Não foi possível enviar ${arquivo.name}.`)
  return anexo
}
export async function abrirAnexo(a: AnexoReuniao) {
  const janela = window.open('', '_blank')
  let url = arquivosDemo.get(a.caminho) ?? ''
  if (supabase) { const { data } = await supabase.storage.from('reunioes').createSignedUrl(a.caminho, 300, { download: !/^(image|application\/pdf)/.test(a.mime ?? '') ? a.nome : undefined }); url = data?.signedUrl ?? '' }
  if (janela) { if (url) janela.location.href = url; else janela.close() }
}
export async function apagarAnexo(a: AnexoReuniao) {
  if (!supabase) { arquivosDemo.delete(a.caminho); return }
  await supabase.storage.from('reunioes').remove([a.caminho])
}

// ---------------------------------------------------------------- agenda do celular (.ics, sem ligar nada externo)
const icsData = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const icsTexto = (t: string) => t.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
export function baixarIcs(r: Reuniao, nomeCliente: string) {
  const regra = r.recorrencia === 'semanal' ? 'RRULE:FREQ=WEEKLY' : r.recorrencia === 'quinzenal' ? 'RRULE:FREQ=WEEKLY;INTERVAL=2' : r.recorrencia === 'mensal' ? 'RRULE:FREQ=MONTHLY' : null
  const pauta = r.pauta.length ? `\n\nPauta:\n${r.pauta.map((p) => `• ${p.texto}`).join('\n')}` : ''
  const linhas = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Luminy//Reunioes//PT', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${r.id}@luminy`, `DTSTAMP:${icsData(new Date())}`, `DTSTART:${icsData(new Date(r.inicio))}`, `DTEND:${icsData(fimDe(r))}`,
    `SUMMARY:${icsTexto(r.titulo)}`, `DESCRIPTION:${icsTexto(`${r.descricao ?? ''}${pauta}\n\n${nomeCliente} · Luminy`.trim())}`,
    ...(r.local ? [`LOCATION:${icsTexto(r.local)}`] : []), ...(regra ? [regra] : []),
    'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', `DESCRIPTION:${icsTexto(r.titulo)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ]
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([linhas.join('\r\n')], { type: 'text/calendar;charset=utf-8' }))
  a.download = `${nomeSeguro(r.titulo)}.ics`; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
