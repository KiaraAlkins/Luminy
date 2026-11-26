/**
 * Entende datas escritas do jeito que a gente fala, dentro do título da tarefa:
 * "Ligar para o RH amanhã às 14h", "Mandar arte sexta", "Reunião dia 15 10h30", "Relatório 30/11".
 * Devolve o título limpo (sem a parte da data) e o prazo.
 */
const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '')

export type DataLida = { titulo: string; prazo: Date | null; rotulo: string | null }

export function lerData(texto: string, agora = new Date()): DataLida {
  let t = ` ${texto} `
  const base = semAcento(t.toLowerCase())
  let dia: Date | null = null
  let hora: [number, number] | null = null
  const cortes: [number, number][] = []
  const achar = (re: RegExp) => { const m = re.exec(base); if (m) cortes.push([m.index, m.index + m[0].length]); return m }

  // Horário: 14h, 14h30, 14:30, às 9h
  const mh = achar(/\s(?:as\s|a\s)?(\d{1,2})(?:h(\d{2})?|:(\d{2}))(?=[\s,.!?]|$)/)
  if (mh) { const h = Number(mh[1]); const m = Number(mh[2] ?? mh[3] ?? 0); if (h < 24 && m < 60) hora = [h, m] }

  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  const mais = (n: number) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + n)
  let m: RegExpExecArray | null
  if ((m = achar(/\s(?:para\s|ate\s)?depois de amanha(?=[\s,.!?]|$)/))) dia = mais(2)
  else if ((m = achar(/\s(?:para\s|ate\s)?amanha(?=[\s,.!?]|$)/))) dia = mais(1)
  else if ((m = achar(/\s(?:para\s|ate\s)?hoje(?=[\s,.!?]|$)/))) dia = hoje
  else if ((m = achar(/\s(?:para\s|ate\s|no\s|na\s|dia\s)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=[\s,.!?]|$)/))) {
    const ano = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : hoje.getFullYear()
    dia = new Date(ano, Number(m[2]) - 1, Number(m[1]))
    if (!m[3] && dia < hoje) dia = new Date(ano + 1, Number(m[2]) - 1, Number(m[1]))
  } else if ((m = achar(/\s(?:para\s|ate\s|no\s|na\s)?(?:proxim[ao]\s)?(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:[\s-]feira)?(?:\s(?:que vem))?(?=[\s,.!?]|$)/))) {
    const alvo = DIAS.indexOf(m[1]); let n = (alvo - hoje.getDay() + 7) % 7; if (n === 0) n = 7
    dia = mais(n)
  } else if ((m = achar(/\s(?:para\s|ate\s|no\s)?dia\s(\d{1,2})(?=[\s,.!?]|$)/))) {
    dia = new Date(hoje.getFullYear(), hoje.getMonth(), Number(m[1]))
    if (dia < hoje) dia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, Number(m[1]))
  }

  if (!dia && !hora) return { titulo: texto.trim(), prazo: null, rotulo: null }
  if (!dia && hora) { dia = hoje; if (hora[0] * 60 + hora[1] <= agora.getHours() * 60 + agora.getMinutes()) dia = mais(1) }
  const prazo = new Date(dia!.getFullYear(), dia!.getMonth(), dia!.getDate(), hora?.[0] ?? 18, hora?.[1] ?? 0)

  // Tira do título os pedaços que eram data (do fim para o começo, para não bagunçar as posições)
  cortes.sort((a, b) => b[0] - a[0]).forEach(([i, f]) => { t = `${t.slice(0, i)} ${t.slice(f)}` })
  const titulo = t.replace(/\s+/g, ' ').replace(/\s(?:as|às|para|até|ate|no|na)\s*$/i, '').trim()
  return { titulo: titulo || texto.trim(), prazo, rotulo: rotuloPrazo(prazo.toISOString(), agora, !!hora) }
}

/** "hoje, 14:00", "amanhã", "sexta, 10:30", "30/11" */
export function rotuloPrazo(iso: string, agora = new Date(), comHora = true): string {
  const d = new Date(iso)
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()
  const dias = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - hoje) / 86_400_000)
  const h = comHora && !(d.getHours() === 18 && d.getMinutes() === 0) ? `, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''
  if (dias === 0) return `hoje${h}`
  if (dias === 1) return `amanhã${h}`
  if (dias === -1) return `ontem${h}`
  if (dias > 1 && dias < 7) return `${d.toLocaleDateString('pt-BR', { weekday: 'long' }).replace('-feira', '')}${h}`
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}${h}`
}

/** Grupo da lista: atrasada, hoje, amanhã, esta semana, mais tarde, sem prazo. */
export type Grupo = 'atrasadas' | 'hoje' | 'amanha' | 'semana' | 'depois' | 'sem_prazo'
export function grupoDe(iso: string | null, agora = new Date()): Grupo {
  if (!iso) return 'sem_prazo'
  const d = new Date(iso)
  if (d.getTime() < agora.getTime()) return 'atrasadas'
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()
  const dias = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - hoje) / 86_400_000)
  return dias <= 0 ? 'hoje' : dias === 1 ? 'amanha' : dias < 7 ? 'semana' : 'depois'
}
