import { supabase } from './supabase'

export type Rotina = {
  id: string; cliente_id: string; titulo: string; descricao: string | null; repeticao: 'semana' | 'mes'; dias_semana: number[]; dia_mes: number | null
  horarios: string[]; responsaveis: string[]; cada_um: boolean; checklist: { id: string; texto: string }[]; exige_foto: boolean
  inicio: string; ativa: boolean; criado_por: string; criado_em: string
}
export type Registro = { id: string; rotina_id: string; data: string; horario: string | null; usuario_id: string; itens: string[]; foto_path: string | null; observacao: string | null; feito_em: string }
/** Uma vez em que a rotina precisa ser feita (um dia, e um horário se tiver). */
export type Ocorrencia = { rotina: Rotina; data: string; horario: string | null; chave: string }

export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const dataIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hhmm = (h: string | null) => (h ? h.slice(0, 5) : null)

/** "Todo dia útil às 09:00 e 16:00", "Seg, Qua e Sex às 10:00", "Todo dia 5 do mês" */
export function descreverRepeticao(r: Pick<Rotina, 'repeticao' | 'dias_semana' | 'dia_mes' | 'horarios'>) {
  const horas = r.horarios.length ? ` às ${r.horarios.map((h) => hhmm(h)).join(' e ')}` : ''
  if (r.repeticao === 'mes') return `Todo dia ${r.dia_mes} do mês${horas}`
  const d = [...r.dias_semana].sort()
  const nome = d.length === 7 ? 'Todo dia' : d.join() === '1,2,3,4,5' ? 'Todo dia útil' : d.join() === '0,6' ? 'Fins de semana'
    : d.length === 1 ? `Toda ${['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][d[0]]}`
      : d.map((x) => DIAS_CURTOS[x]).join(', ').replace(/, ([^,]*)$/, ' e $1')
  return `${nome}${horas}`
}

/** As ocorrências de uma rotina num dia (nenhuma, uma, ou uma por horário). */
export function ocorrenciasNoDia(r: Rotina, dia: Date): Ocorrencia[] {
  const data = dataIso(dia)
  if (!r.ativa || data < r.inicio) return []
  if (r.repeticao === 'semana' && !r.dias_semana.includes(dia.getDay())) return []
  if (r.repeticao === 'mes') {
    const ultimo = new Date(dia.getFullYear(), dia.getMonth() + 1, 0).getDate()
    if (dia.getDate() !== Math.min(r.dia_mes ?? 1, ultimo)) return []
  }
  const horarios = r.horarios.length ? r.horarios.map(hhmm) : [null]
  return horarios.map((h) => ({ rotina: r, data, horario: h, chave: `${r.id}|${data}|${h ?? ''}` }))
}

/** A ocorrência já foi feita? (por qualquer um, ou pela própria pessoa quando "cada um faz a sua") */
export function feitoPor(o: Ocorrencia, registros: Registro[], usuarioId?: string) {
  return registros.find((g) => g.rotina_id === o.rotina.id && g.data === o.data && hhmm(g.horario) === o.horario && (!o.rotina.cada_um || !usuarioId || g.usuario_id === usuarioId))
}
export const prazoDe = (o: Ocorrencia) => `${o.data}T${o.horario ?? '23:59'}:00`
export const minha = (r: Rotina, usuarioId: string) => r.responsaveis.length === 0 || r.responsaveis.includes(usuarioId)

// ---------------------------------------------------------------- demonstração
const hoje = new Date()
const antes = (n: number, h: number, m = 0) => { const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - n, h, m); return d }
let demo: Rotina[] = [
  { id: 'r1', cliente_id: 'hospital', titulo: 'Responder comentários do Instagram', descricao: 'Responder todos os comentários e directs. Dúvidas médicas: encaminhar para a central.', repeticao: 'semana', dias_semana: [1, 2, 3, 4, 5], dia_mes: null, horarios: ['09:00', '16:00'], responsaveis: [], cada_um: false, checklist: [], exige_foto: false, inicio: '2026-11-01', ativa: true, criado_por: 'p1', criado_em: antes(20, 9).toISOString() },
  { id: 'r2', cliente_id: 'hospital', titulo: 'Ronda no hospital para fotos', descricao: 'Passar pelos setores e registrar boas histórias para os stories.', repeticao: 'semana', dias_semana: [1, 3, 5], dia_mes: null, horarios: ['10:00'], responsaveis: ['p3', 'p4'], cada_um: false,
    checklist: [{ id: 'a', texto: 'Recepção' }, { id: 'b', texto: 'UTI' }, { id: 'c', texto: 'Maternidade' }, { id: 'd', texto: 'Pronto-socorro' }], exige_foto: true, inicio: '2026-11-01', ativa: true, criado_por: 'p1', criado_em: antes(20, 9).toISOString() },
  { id: 'r3', cliente_id: 'hospital', titulo: 'Postar os stories do dia', descricao: null, repeticao: 'semana', dias_semana: [0, 1, 2, 3, 4, 5, 6], dia_mes: null, horarios: ['12:00'], responsaveis: ['p1', 'p4'], cada_um: false, checklist: [], exige_foto: false, inicio: '2026-11-01', ativa: true, criado_por: 'p1', criado_em: antes(20, 9).toISOString() },
  { id: 'r4', cliente_id: 'hospital', titulo: 'Conferir estoque de brindes', descricao: null, repeticao: 'semana', dias_semana: [1], dia_mes: null, horarios: [], responsaveis: ['p3'], cada_um: false, checklist: [], exige_foto: false, inicio: '2026-11-01', ativa: true, criado_por: 'p1', criado_em: antes(20, 9).toISOString() },
  { id: 'r5', cliente_id: 'hospital', titulo: 'Relatório mensal de redes sociais', descricao: null, repeticao: 'mes', dias_semana: [], dia_mes: 5, horarios: ['17:00'], responsaveis: ['p1'], cada_um: false, checklist: [], exige_foto: false, inicio: '2026-11-01', ativa: true, criado_por: 'p1', criado_em: antes(20, 9).toISOString() },
]
let registrosDemo: Registro[] = []
for (let n = 1; n <= 7; n++) {
  const dia = antes(n, 12)
  demo.forEach((r) => ocorrenciasNoDia(r, dia).forEach((o, i) => {
    if ((n + i + r.id.length) % 5 === 0) return // alguns ficaram para trás
    const [h, m] = (o.horario ?? '15:00').split(':').map(Number)
    registrosDemo.push({ id: `g${registrosDemo.length}`, rotina_id: r.id, data: o.data, horario: o.horario, usuario_id: r.responsaveis[n % Math.max(1, r.responsaveis.length)] ?? 'p2', itens: r.checklist.map((c) => c.id), foto_path: null, observacao: null, feito_em: antes(n, h, m + 12).toISOString() })
  }))
}
{
  const o = ocorrenciasNoDia(demo[0], hoje)[0]
  if (o) registrosDemo.push({ id: 'gh', rotina_id: 'r1', data: o.data, horario: o.horario, usuario_id: 'p2', itens: [], foto_path: null, observacao: null, feito_em: antes(0, 9, 20).toISOString() })
}
const fotosDemo = new Map<string, string>()

// ---------------------------------------------------------------- API
export async function listarRotinas(clienteId?: string): Promise<Rotina[]> {
  if (!supabase) return demo.filter((r) => !clienteId || r.cliente_id === clienteId)
  let q = supabase.from('rotinas').select('*').order('criado_em')
  if (clienteId) q = q.eq('cliente_id', clienteId)
  const { data, error } = await q
  if (error) throw error
  return (data as Rotina[]).map((r) => ({ ...r, horarios: (r.horarios ?? []).map((h) => h.slice(0, 5)) }))
}

export async function listarRegistros(rotinaIds: string[], desde: string): Promise<Registro[]> {
  if (!supabase) return registrosDemo.filter((g) => rotinaIds.includes(g.rotina_id) && g.data >= desde)
  if (!rotinaIds.length) return []
  const { data } = await supabase.from('rotina_registros').select('*').in('rotina_id', rotinaIds).gte('data', desde)
  return ((data ?? []) as Registro[]).map((g) => ({ ...g, horario: g.horario ? g.horario.slice(0, 5) : null }))
}

export type DadosRotina = Omit<Rotina, 'id' | 'cliente_id' | 'criado_por' | 'criado_em'>
export async function salvarRotina(clienteId: string, dados: DadosRotina, id?: string) {
  if (!supabase) {
    if (id) demo = demo.map((r) => (r.id === id ? { ...r, ...dados } : r))
    else demo = [...demo, { ...dados, id: crypto.randomUUID(), cliente_id: clienteId, criado_por: 'p1', criado_em: new Date().toISOString() }]
    return
  }
  const r = id ? await supabase.from('rotinas').update(dados).eq('id', id) : await supabase.from('rotinas').insert({ ...dados, cliente_id: clienteId })
  if (r.error) throw new Error(r.error.code === '42501' ? 'Só administradores criam e mudam rotinas.' : 'Não foi possível salvar a rotina.')
}

export async function excluirRotina(id: string) {
  if (!supabase) { demo = demo.filter((r) => r.id !== id); return }
  const { error } = await supabase.from('rotinas').delete().eq('id', id)
  if (error) throw new Error('Só administradores excluem rotinas.')
}

/** Marca a ocorrência como feita (com checklist, foto e observação, quando houver). */
export async function marcarFeito(o: Ocorrencia, extra: { itens?: string[]; foto?: File | null; observacao?: string | null } = {}, usuarioId = 'p1') {
  let foto_path: string | null = null
  if (extra.foto) {
    const { reduzirImagem } = await import('./imagens')
    const blob = await reduzirImagem(extra.foto, 1400)
    foto_path = `${o.rotina.cliente_id}/${o.rotina.id}/${o.data}-${Date.now()}.webp`
    if (!supabase) fotosDemo.set(foto_path, URL.createObjectURL(blob))
    else {
      const { error } = await supabase.storage.from('rotinas').upload(foto_path, blob, { contentType: 'image/webp' })
      if (error) throw new Error('Não foi possível enviar a foto.')
    }
  }
  const registro = { rotina_id: o.rotina.id, data: o.data, horario: o.horario, itens: extra.itens ?? [], foto_path, observacao: extra.observacao?.trim() || null }
  if (!supabase) { registrosDemo.push({ ...registro, id: crypto.randomUUID(), usuario_id: usuarioId, feito_em: new Date().toISOString() }); return }
  const { error } = await supabase.from('rotina_registros').insert(registro)
  if (error) throw new Error(error.code === '23505' ? 'Alguém já marcou esta rotina.' : error.code === '42501' ? 'Esta rotina é de outra pessoa.' : error.code === '23514' ? 'Esta rotina pede uma foto.' : 'Não foi possível marcar.')
}

export async function desmarcar(registroId: string) {
  if (!supabase) { registrosDemo = registrosDemo.filter((g) => g.id !== registroId); return }
  const { error } = await supabase.from('rotina_registros').delete().eq('id', registroId)
  if (error) throw new Error('Não foi possível desmarcar.')
}

export async function linkFotoRotina(caminho: string): Promise<string | null> {
  if (!supabase) return fotosDemo.get(caminho) ?? null
  const { data } = await supabase.storage.from('rotinas').createSignedUrl(caminho, 3600)
  return data?.signedUrl ?? null
}
