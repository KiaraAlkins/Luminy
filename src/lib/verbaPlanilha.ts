import { normalizar, textoDe, type Valor } from './planilhas'

/**
 * Entende planilhas de verba (orçamento) do marketing em vários formatos:
 *  • meses nas linhas:  Mês | Verba          (jan/2027, Janeiro, 01/2027, 2027-01, uma data…)
 *  • meses nas colunas: Jan | Fev | Mar …    (com uma linha "Verba"/"Total" ou várias categorias, que são somadas)
 * O ano vem do próprio mês ("jan/27"), de um título com o ano ("Orçamento 2027") ou do ano escolhido.
 */
export type VerbaLida = { mes: string; valor: number; detalhe: string | null }
export type LeituraVerba = { meses: VerbaLida[]; avisos: string[]; formato: 'linhas' | 'colunas' }

const MESES: [string[], number][] = [
  [['janeiro', 'jan', 'january'], 1], [['fevereiro', 'fev', 'february', 'feb'], 2], [['marco', 'mar', 'march'], 3], [['abril', 'abr', 'april', 'apr'], 4],
  [['maio', 'mai', 'may'], 5], [['junho', 'jun', 'june'], 6], [['julho', 'jul', 'july'], 7], [['agosto', 'ago', 'august', 'aug'], 8],
  [['setembro', 'set', 'september', 'sep', 'sept'], 9], [['outubro', 'out', 'october', 'oct'], 10], [['novembro', 'nov', 'november'], 11], [['dezembro', 'dez', 'december', 'dec'], 12],
]
const iso = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, '0')}-01`
const ano4 = (t: string) => { const n = Number(t); return t.length === 2 ? 2000 + n : n }
const ROTULO_VERBA = /^(verba|orcamento|orcado|budget|total|valor|previsto|planejado|limite|teto)\b/

/** Mês de uma célula: devolve "AAAA-MM-01" (ano padrão quando não vem ano) ou null. */
export function mesDe(v: Valor, anoPadrao: number): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date) return iso(v.getFullYear(), v.getMonth() + 1)
  const t = normalizar(textoDe(v))
  if (!t) return null
  // números: 2027-01, 2027/1, 01/2027, 1-27, 15/01/2027
  let m = t.match(/^(\d{4}) (\d{1,2})(?: \d{1,2})?$/)
  if (m && +m[2] >= 1 && +m[2] <= 12) return iso(+m[1], +m[2])
  m = t.match(/^(?:(\d{1,2}) )?(\d{1,2}) (\d{2}|\d{4})$/)
  if (m && +m[2] >= 1 && +m[2] <= 12) return iso(ano4(m[3]), +m[2])
  // nomes: "janeiro", "jan 27", "janeiro de 2027", "jan 2027", "1 jan"
  const palavras = t.split(' ').filter((p) => p !== 'de' && p !== 'del')
  const achado = MESES.find(([nomes]) => nomes.includes(palavras[0]) || (palavras.length > 1 && /^\d{1,2}$/.test(palavras[0]) && nomes.includes(palavras[1])))
  if (!achado) return null
  const resto = palavras.slice(1).filter((p) => /^\d{2}$|^\d{4}$/.test(p) && !MESES.some(([n]) => n.includes(p)))
  const ano = resto.find((p) => p.length === 4 || (p.length === 2 && palavras.length > 1 && palavras.indexOf(p) > 0))
  // "jan" sozinho, ou com outras palavras que não são ano (ex.: "jan verba") só vale se a primeira palavra for o mês
  if (palavras.length > 2 && !ano && !/^\d{1,2}$/.test(palavras[0])) return null
  return iso(ano ? ano4(ano) : anoPadrao, achado[1])
}

/** Valor em reais escrito de qualquer jeito: "R$ 15.000,00", "12.000", "15000", "1,250.50". */
export function valorDe(v: Valor): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  const t = textoDe(v).replace(/[^\d,.-]/g, '')
  if (!t || !/\d/.test(t)) return null
  const ponto = t.lastIndexOf('.'), virgula = t.lastIndexOf(',')
  let n: number
  if (ponto >= 0 && virgula >= 0) n = Number(ponto > virgula ? t.replace(/,/g, '') : t.replace(/\./g, '').replace(',', '.'))
  else if (ponto >= 0) n = Number(/^-?\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t)
  else if (virgula >= 0) n = Number(/^-?\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.'))
  else n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Ano citado num título ou cabeçalho (ex.: "Orçamento de marketing 2027"). */
function anoDoTitulo(linhas: Valor[][]): number | null {
  for (const l of linhas.slice(0, 6)) for (const c of l) {
    if (typeof c !== 'string') continue
    const m = c.match(/\b(20\d{2})\b/)
    if (m && !mesDe(c, 2000)) return Number(m[1])
  }
  return null
}

export function lerVerbas(linhas: Valor[][], anoEscolhido: number): LeituraVerba {
  const avisos: string[] = []
  const anoTitulo = anoDoTitulo(linhas)
  const ano = anoTitulo ?? anoEscolhido
  if (anoTitulo && anoTitulo !== anoEscolhido) avisos.push(`Usei o ano ${anoTitulo}, que está escrito na planilha, para os meses sem ano.`)

  // 1) Meses nas colunas: uma linha com 3+ meses é o cabeçalho
  const iCab = linhas.findIndex((l) => l.filter((c) => mesDe(c, ano)).length >= 3)
  if (iCab >= 0) {
    const colunas = linhas[iCab].map((c, i) => ({ i, mes: mesDe(c, ano) })).filter((x): x is { i: number; mes: string } => !!x.mes)
    const linhasValor = linhas.slice(iCab + 1).map((l) => {
      const rotulo = l.map((c) => textoDe(c).trim()).find((t, i) => t && !colunas.some((x) => x.i === i) && valorDe(t) === null) ?? ''
      const valores = colunas.map((x) => valorDe(l[x.i]))
      return { rotulo, valores }
    }).filter((r) => r.valores.some((v) => v != null && v > 0))
    if (!linhasValor.length) throw new Error('Achei os meses no cabeçalho, mas nenhuma linha com valores embaixo deles.')
    const principal = linhasValor.find((r) => ROTULO_VERBA.test(normalizar(r.rotulo)))
    let usadas = linhasValor
    if (principal) {
      usadas = [principal]
      if (linhasValor.length > 1) avisos.push(`Usei a linha "${principal.rotulo}" como verba de cada mês.`)
    } else if (linhasValor.length > 1) {
      avisos.push(`Somei as ${linhasValor.length} linhas (${linhasValor.slice(0, 4).map((r) => r.rotulo || 'sem nome').join(', ')}${linhasValor.length > 4 ? '…' : ''}) para chegar na verba de cada mês.`)
    }
    const meses = colunas.map((x, k) => {
      const soma = usadas.reduce((t, r) => t + (r.valores[k] ?? 0), 0)
      return { mes: x.mes, valor: Math.round(soma * 100) / 100, detalhe: usadas.length > 1 ? `${usadas.filter((r) => r.valores[k]).length} linhas somadas` : null }
    }).filter((m) => m.valor > 0)
    return { meses: juntar(meses, avisos), avisos, formato: 'colunas' }
  }

  // 2) Meses nas linhas: a coluna que mais tem meses, e a coluna de valor ao lado
  const largura = Math.max(...linhas.map((l) => l.length))
  const contagem = Array.from({ length: largura }, (_, i) => linhas.filter((l) => mesDe(l[i], ano)).length)
  const colMes = contagem.indexOf(Math.max(...contagem))
  if (contagem[colMes] < 1) throw new Error('Não achei os meses na planilha. Use uma coluna "Mês" (ex.: jan/2027) e outra "Verba", ou os meses como colunas (Jan, Fev, Mar…).')
  const cabecalho = linhas.find((l) => l.some((c) => typeof c === 'string' && ROTULO_VERBA.test(normalizar(c))))
  let colValor = cabecalho ? cabecalho.findIndex((c, i) => i !== colMes && typeof c === 'string' && ROTULO_VERBA.test(normalizar(c))) : -1
  if (colValor < 0) {
    const numericas = Array.from({ length: largura }, (_, i) => (i === colMes ? -1 : linhas.filter((l) => mesDe(l[colMes], ano) && valorDe(l[i]) != null).length))
    colValor = numericas.indexOf(Math.max(...numericas))
  }
  if (colValor < 0) throw new Error('Achei os meses, mas não a coluna com o valor da verba.')
  const meses = linhas.map((l) => ({ mes: mesDe(l[colMes], ano), valor: valorDe(l[colValor]) }))
    .filter((x): x is { mes: string; valor: number } => !!x.mes && x.valor != null && x.valor > 0)
    .map((x) => ({ ...x, detalhe: null }))
  if (!meses.length) throw new Error('Achei os meses, mas nenhum valor de verba ao lado deles.')
  return { meses: juntar(meses, avisos), avisos, formato: 'linhas' }
}

/** O mesmo mês aparecendo mais de uma vez (ex.: uma linha por categoria) é somado. */
function juntar(meses: VerbaLida[], avisos: string[]): VerbaLida[] {
  const mapa = new Map<string, VerbaLida & { n: number }>()
  meses.forEach((m) => {
    const j = mapa.get(m.mes)
    if (j) { j.valor = Math.round((j.valor + m.valor) * 100) / 100; j.n++; j.detalhe = `${j.n} linhas somadas` } else mapa.set(m.mes, { ...m, n: 1 })
  })
  if ([...mapa.values()].some((m) => m.n > 1)) avisos.push('Alguns meses aparecem mais de uma vez (ex.: uma linha por categoria) e foram somados.')
  return [...mapa.values()].map((m) => ({ mes: m.mes, valor: m.valor, detalhe: m.detalhe })).sort((a, b) => a.mes.localeCompare(b.mes))
}
