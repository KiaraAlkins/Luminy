import { supabase } from './supabase'

/** Ponto: entrada, almoço e saída. Banco de horas por ciclo (padrão: a cada 3 meses, zerando no fim de março, junho, setembro e dezembro). */
export type ConfigPonto = { cliente_id: string; entrada: string; saida: string; saida_sexta: string; almoco_min: number; tolerancia_min: number; ciclo_meses: number; ciclo_inicio: string }
export type Marca = 'entrada' | 'almoco_saida' | 'almoco_volta' | 'saida'
export type Ponto = {
  id: string; cliente_id: string; usuario_id: string; dia: string
  entrada: string | null; almoco_saida: string | null; almoco_volta: string | null; saida: string | null
  esquecidos: Marca[]; justificativa: string | null; foto_path: string | null; origem: 'app' | 'manual' | 'planilha'; atualizado_em: string
}
export type EdicaoPonto = Partial<Pick<Ponto, Marca | 'esquecidos' | 'justificativa' | 'foto_path' | 'origem'>>

export const MARCAS: { id: Marca; nome: string; curto: string }[] = [
  { id: 'entrada', nome: 'Entrada', curto: 'Entrada' },
  { id: 'almoco_saida', nome: 'Saída para o almoço', curto: 'Almoço' },
  { id: 'almoco_volta', nome: 'Volta do almoço', curto: 'Volta' },
  { id: 'saida', nome: 'Saída', curto: 'Saída' },
]
export const configPadrao = (clienteId: string): ConfigPonto => ({ cliente_id: clienteId, entrada: '08:00', saida: '18:00', saida_sexta: '17:00', almoco_min: 60, tolerancia_min: 15, ciclo_meses: 3, ciclo_inicio: '2026-01-01' })

// ---------------------------------------------------------------- horários
export const hm = (t: string | null) => (t ? t.slice(0, 5) : null)
export const minutos = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
export const deMinutos = (n: number) => `${String(Math.floor(((n % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((n % 60) + 60) % 60).padStart(2, '0')}`
export const diaIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const diaDe = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d) }
/** "+3h20", "−1h05", "0h00" */
export function saldoTexto(min: number, sinal = true) {
  const a = Math.abs(Math.round(min))
  return `${sinal ? (min > 0 ? '+' : min < 0 ? '−' : '') : ''}${Math.floor(a / 60)}h${String(a % 60).padStart(2, '0')}`
}

/** Horário esperado do dia: seg–qui até a saída normal, sexta até mais cedo, fim de semana não tem. */
export function jornadaDoDia(c: ConfigPonto, dia: string): { entrada: string; saida: string; almoco: number; esperado: number } | null {
  const ds = diaDe(dia).getDay()
  if (ds === 0 || ds === 6) return null
  const saida = hm(ds === 5 ? c.saida_sexta : c.saida)!
  const entrada = hm(c.entrada)!
  return { entrada, saida, almoco: c.almoco_min, esperado: minutos(saida) - minutos(entrada) - c.almoco_min }
}

/** Horário que vale para a conta: o registrado ou, se a marca foi dada como esquecida, o da jornada. */
function valor(p: Ponto, m: Marca, c: ConfigPonto): string | null {
  if (p[m]) return hm(p[m])
  if (!p.esquecidos.includes(m)) return null
  const j = jornadaDoDia(c, p.dia)
  if (!j) return null
  const almoco = minutos(j.entrada) + Math.round((minutos(j.saida) - minutos(j.entrada) - j.almoco) / 2)
  return m === 'entrada' ? j.entrada : m === 'saida' ? j.saida : m === 'almoco_saida' ? deMinutos(almoco) : deMinutos(almoco + j.almoco)
}

export type ResumoDia = {
  trabalhado: number | null; esperado: number; saldo: number | null
  atraso: number          // minutos além da tolerância (0 = no horário)
  incompleto: Marca[]     // marcas que faltam e não foram dadas como esquecidas
  avisos: string[]
}
export function resumoDia(p: Ponto, c: ConfigPonto): ResumoDia {
  const j = jornadaDoDia(c, p.dia)
  const esperado = j?.esperado ?? 0
  const e = valor(p, 'entrada', c); const s = valor(p, 'saida', c)
  const as = valor(p, 'almoco_saida', c); const av = valor(p, 'almoco_volta', c)
  const incompleto = MARCAS.map((x) => x.id).filter((m) => !p[m] && !p.esquecidos.includes(m))
  const atraso = j && p.entrada ? Math.max(0, minutos(hm(p.entrada)!) - minutos(j.entrada) - c.tolerancia_min) : 0
  let trabalhado: number | null = null
  if (e && s) {
    // Chegada dentro da tolerância conta como no horário
    const entradaConta = j && minutos(e) > minutos(j.entrada) && minutos(e) <= minutos(j.entrada) + c.tolerancia_min ? minutos(j.entrada) : minutos(e)
    const almoco = as && av ? Math.max(0, minutos(av) - minutos(as)) : j ? c.almoco_min : 0
    trabalhado = Math.max(0, minutos(s) - entradaConta - almoco)
  }
  const avisos: string[] = []
  if (atraso > 0) avisos.push(`Atrasado ${saldoTexto(atraso + c.tolerancia_min, false)}`)
  p.esquecidos.forEach((m) => avisos.push(`Esquecido: ${MARCAS.find((x) => x.id === m)!.curto.toLowerCase()}`))
  if (incompleto.length && incompleto.length < 4) avisos.push(`Falta: ${incompleto.map((m) => MARCAS.find((x) => x.id === m)!.curto.toLowerCase()).join(', ')}`)
  if (p.justificativa) avisos.push(`Justificado: ${p.justificativa}`)
  return { trabalhado, esperado, saldo: trabalhado === null ? null : trabalhado - esperado, atraso, incompleto, avisos }
}

/** Ciclo do banco de horas que contém o dia (ex.: out–dez). */
export function cicloDe(c: ConfigPonto, hoje = new Date()): { inicio: string; fim: string; nome: string; zeraEm: string } {
  const base = diaDe(c.ciclo_inicio)
  const meses = (hoje.getFullYear() - base.getFullYear()) * 12 + hoje.getMonth() - base.getMonth()
  const k = Math.floor(meses / c.ciclo_meses)
  const ini = new Date(base.getFullYear(), base.getMonth() + k * c.ciclo_meses, 1)
  const prox = new Date(ini.getFullYear(), ini.getMonth() + c.ciclo_meses, 1)
  const fim = new Date(prox.getFullYear(), prox.getMonth(), 0)
  const mes = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
  return { inicio: diaIso(ini), fim: diaIso(fim), nome: `${mes(ini)}–${mes(fim)} ${fim.getFullYear()}`, zeraEm: prox.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }) }
}
export function saldoPeriodo(pontos: Ponto[], c: ConfigPonto, de: string, ate: string) {
  const doPeriodo = pontos.filter((p) => p.dia >= de && p.dia <= ate)
  const r = doPeriodo.map((p) => resumoDia(p, c))
  return {
    saldo: r.reduce((t, x) => t + (x.saldo ?? 0), 0),
    trabalhado: r.reduce((t, x) => t + (x.trabalhado ?? 0), 0),
    dias: doPeriodo.length, atrasos: r.filter((x) => x.atraso > 0).length,
    esquecidos: doPeriodo.filter((p) => p.esquecidos.length).length,
    incompletos: r.filter((x, i) => doPeriodo[i].dia !== diaIso(new Date()) && x.incompleto.length && x.incompleto.length < 4).length,
  }
}

// ---------------------------------------------------------------- dados de demonstração
const demo: { config: ConfigPonto | null; pontos: Ponto[] } = { config: null, pontos: [] }
;(() => {
  const hoje = new Date()
  const pessoas = ['p1', 'p2', 'p3', 'p4']
  let n = 0
  for (let i = 1; i <= 45; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - i)
    if (d.getDay() === 0 || d.getDay() === 6) continue
    pessoas.forEach((u, k) => {
      n++
      const sexta = d.getDay() === 5
      const variar = (base: number, amp: number) => deMinutos(base + ((n * 37 + k * 11 + i * 7) % (amp * 2 + 1)) - amp)
      const atrasado = (n % 17 === 0)
      const esquecido = (n % 23 === 0)
      demo.pontos.push({
        id: `pt${n}`, cliente_id: 'hospital', usuario_id: u, dia: diaIso(d),
        entrada: atrasado ? variar(8 * 60 + 25, 5) : variar(7 * 60 + 58, 6), almoco_saida: variar(12 * 60, 10), almoco_volta: variar(13 * 60 + 2, 6),
        saida: esquecido ? null : variar((sexta ? 17 : 18) * 60 + (u === 'p1' ? 20 : 5), 12),
        esquecidos: esquecido ? ['saida'] : [], justificativa: esquecido ? 'Relógio de ponto sem papel' : null, foto_path: null, origem: 'app', atualizado_em: d.toISOString(),
      })
    })
  }
})()
const fotosDemo = new Map<string, string>()

// ---------------------------------------------------------------- dados
export async function carregarConfig(clienteId: string): Promise<ConfigPonto> {
  if (!supabase) return demo.config ?? configPadrao(clienteId)
  const { data } = await supabase.from('ponto_config').select('*').eq('cliente_id', clienteId).maybeSingle()
  return data ? { ...(data as ConfigPonto), entrada: hm((data as ConfigPonto).entrada)!, saida: hm((data as ConfigPonto).saida)!, saida_sexta: hm((data as ConfigPonto).saida_sexta)! } : configPadrao(clienteId)
}
export async function salvarConfig(c: ConfigPonto) {
  if (!supabase) { demo.config = c; return }
  const { error } = await supabase.from('ponto_config').upsert({ ...c, atualizado_em: new Date().toISOString() })
  if (error) throw error
}

/** Pontos do período. Sem `usuarioId`, traz todos que a pessoa pode ver (administradores veem a equipe toda). */
export async function listarPontos(clienteId: string, de: string, ate: string, usuarioId?: string): Promise<Ponto[]> {
  if (!supabase) return demo.pontos.filter((p) => p.dia >= de && p.dia <= ate && (!usuarioId || p.usuario_id === usuarioId)).sort((a, b) => a.dia.localeCompare(b.dia))
  let q = supabase.from('pontos').select('*').eq('cliente_id', clienteId).gte('dia', de).lte('dia', ate).order('dia')
  if (usuarioId) q = q.eq('usuario_id', usuarioId)
  const { data, error } = await q
  if (error) throw error
  return (data as Ponto[]).map((p) => ({ ...p, entrada: hm(p.entrada), almoco_saida: hm(p.almoco_saida), almoco_volta: hm(p.almoco_volta), saida: hm(p.saida) }))
}

export async function salvarPonto(clienteId: string, usuarioId: string, dia: string, dados: EdicaoPonto): Promise<Ponto> {
  if (!supabase) {
    const atual = demo.pontos.find((p) => p.usuario_id === usuarioId && p.dia === dia)
    const novo: Ponto = { id: atual?.id ?? crypto.randomUUID(), cliente_id: clienteId, usuario_id: usuarioId, dia, entrada: null, almoco_saida: null, almoco_volta: null, saida: null, esquecidos: [], justificativa: null, foto_path: null, origem: 'app', ...(atual ?? {}), ...dados, atualizado_em: new Date().toISOString() }
    demo.pontos = [...demo.pontos.filter((p) => p !== atual), novo]
    return novo
  }
  const { data, error } = await supabase.from('pontos').upsert({ cliente_id: clienteId, usuario_id: usuarioId, dia, ...dados }, { onConflict: 'cliente_id,usuario_id,dia' }).select('*').single()
  if (error) throw error
  return data as Ponto
}

export async function excluirPonto(id: string) {
  if (!supabase) { demo.pontos = demo.pontos.filter((p) => p.id !== id); return }
  const { error } = await supabase.from('pontos').delete().eq('id', id)
  if (error) throw error
}

export async function importarPontos(clienteId: string, usuarioId: string, itens: ({ dia: string } & EdicaoPonto)[]) {
  for (const { dia, ...d } of itens) await salvarPonto(clienteId, usuarioId, dia, { ...d, origem: 'planilha' })
  return itens.length
}

const nomeSeguro = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').slice(-60)
export async function enviarFotoPonto(clienteId: string, usuarioId: string, arquivo: File): Promise<string> {
  if (arquivo.size > 10 * 1024 * 1024) throw new Error('Foto maior que 10 MB.')
  let corpo: Blob = arquivo
  if (/^image\/(jpeg|png|webp)$/.test(arquivo.type) && arquivo.size > 600_000) { const { reduzirImagem } = await import('./imagens'); corpo = await reduzirImagem(arquivo, 1600) }
  const caminho = `${clienteId}/${usuarioId}/${Date.now()}-${nomeSeguro(arquivo.name)}`
  if (!supabase) { fotosDemo.set(caminho, URL.createObjectURL(corpo)); return caminho }
  const { error } = await supabase.storage.from('ponto').upload(caminho, corpo, { contentType: corpo.type || undefined })
  if (error) throw new Error('Não foi possível enviar a foto.')
  return caminho
}
export async function linkFotoPonto(caminho: string): Promise<string | null> {
  if (!supabase) return fotosDemo.get(caminho) ?? null
  const { data } = await supabase.storage.from('ponto').createSignedUrl(caminho, 600)
  return data?.signedUrl ?? null
}

// ---------------------------------------------------------------- lembretes (opcionais)
const chaveLembretes = (clienteId: string) => `luminy.ponto.lembretes.${clienteId}`
export function lembretesLigados(clienteId: string) { try { return localStorage.getItem(chaveLembretes(clienteId)) !== 'off' } catch { return true } }
export function definirLembretes(clienteId: string, ligado: boolean) { try { localStorage.setItem(chaveLembretes(clienteId), ligado ? 'on' : 'off') } catch { /* sem armazenamento */ } }
const chaveIgnorado = (clienteId: string, dia: string) => `luminy.ponto.ignorado.${clienteId}.${dia}`
export function ignoradosHoje(clienteId: string, dia: string): string[] { try { return JSON.parse(localStorage.getItem(chaveIgnorado(clienteId, dia)) ?? '[]') as string[] } catch { return [] } }
export function ignorarHoje(clienteId: string, dia: string, etapa: string) {
  try { localStorage.setItem(chaveIgnorado(clienteId, dia), JSON.stringify([...new Set([...ignoradosHoje(clienteId, dia), etapa])])) } catch { /* sem armazenamento */ }
}
