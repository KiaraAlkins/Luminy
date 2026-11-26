/**
 * Planilhas: exportar (Excel, CSV ou colar no Google Planilhas) e importar (Excel, CSV ou link do Google Planilhas).
 * As bibliotecas de Excel só carregam quando alguém usa (não pesam no resto do site).
 */
export type Valor = string | number | Date | null | undefined
export type Tabela = { colunas: string[]; linhas: Valor[][] }

// ---------------------------------------------------------------- exportar
const texto = (v: Valor) => (v == null ? '' : v instanceof Date ? v.toLocaleDateString('pt-BR') : String(v))

function baixar(blob: Blob, nome: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

export async function exportarExcel(t: Tabela, nome: string, aba = 'Dados') {
  const { default: escrever } = await import('write-excel-file/browser')
  const cabecalho = t.colunas.map((c) => ({ value: c, fontWeight: 'bold' as const, backgroundColor: '#ECE8FF' }))
  const dados = t.linhas.map((l) => l.map((v) => (v == null || v === '' ? null : v instanceof Date ? { value: v, type: Date, format: 'dd/mm/yyyy' } : { value: v })))
  const larguras = t.colunas.map((c, i) => ({ width: Math.min(48, Math.max(c.length, ...t.linhas.slice(0, 200).map((l) => texto(l[i]).length)) + 2) }))
  const blob = await escrever([cabecalho, ...dados] as never, { sheet: aba, columns: larguras, stickyRowsCount: 1 } as never).toBlob()
  baixar(blob, `${nome}.xlsx`)
}

export function exportarCsv(t: Tabela, nome: string) {
  const celula = (v: Valor) => `"${texto(v).replace(/"/g, '""')}"`
  const csv = [t.colunas, ...t.linhas].map((l) => l.map(celula).join(';')).join('\r\n')
  baixar(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `${nome}.csv`)
}

/** Copia como tabela (separada por tabulação) e abre uma planilha nova do Google: é só colar (Ctrl+V). */
export async function abrirNoGoogle(t: Tabela) {
  const tsv = [t.colunas, ...t.linhas].map((l) => l.map((v) => texto(v).replace(/[\t\n\r]+/g, ' ')).join('\t')).join('\n')
  await navigator.clipboard.writeText(tsv)
  window.open('https://sheets.new', '_blank', 'noreferrer')
}

// ---------------------------------------------------------------- importar
/** CSV ou TSV: descobre o separador (; , ou tabulação) e respeita aspas. */
export function lerCsv(conteudo: string): string[][] {
  const txt = conteudo.replace(/^﻿/, '')
  const primeira = txt.split(/\r?\n/)[0] ?? ''
  const sep = ['\t', ';', ','].sort((a, b) => primeira.split(b).length - primeira.split(a).length)[0]
  const linhas: string[][] = []; let linha: string[] = []; let campo = ''; let aspas = false
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i]
    if (aspas) {
      if (c === '"' && txt[i + 1] === '"') { campo += '"'; i++ } else if (c === '"') aspas = false; else campo += c
    } else if (c === '"') aspas = true
    else if (c === sep) { linha.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; linha.push(campo); linhas.push(linha); linha = []; campo = '' }
    else campo += c
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha) }
  return linhas.filter((l) => l.some((x) => x.trim()))
}

export async function lerArquivo(arquivo: File): Promise<Valor[][]> {
  if (/\.(xlsx|xlsm)$/i.test(arquivo.name)) {
    const { readSheet } = await import('read-excel-file/browser')
    const dados = await readSheet(arquivo)
    return (dados as unknown as Valor[][]).map((l) => l.map((v) => (typeof v === 'boolean' ? (v ? 'sim' : 'não') : v)))
  }
  if (/\.xls$/i.test(arquivo.name)) throw new Error('Arquivo .xls antigo: abra no Excel e salve como .xlsx (ou CSV).')
  return lerCsv(await arquivo.text())
}

/**
 * Lê uma planilha do Google pelo link. A planilha precisa estar compartilhada como
 * "Qualquer pessoa com o link pode ver" (dá para voltar para restrito depois de importar).
 */
export async function lerGoogle(link: string): Promise<Valor[][]> {
  const id = link.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1]
  if (!id) throw new Error('Cole o link da planilha do Google (docs.google.com/spreadsheets/…).')
  const gid = link.match(/[#&?]gid=(\d+)/)?.[1] ?? '0'
  let r: Response
  try { r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`) }
  catch { throw new Error('Não consegui abrir a planilha. Confira se ela está compartilhada como "Qualquer pessoa com o link".') }
  const corpo = await r.text()
  if (!r.ok || /^\s*<!doctype html|<html/i.test(corpo)) throw new Error('A planilha está privada. No Google Planilhas: Compartilhar › Qualquer pessoa com o link › Leitor.')
  return lerCsv(corpo)
}

// ---------------------------------------------------------------- colunas
export const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Descobre qual coluna da planilha é qual campo, pelos nomes mais comuns (ex.: "Celular" = whatsapp). */
export function mapearColunas(cabecalho: Valor[], sinonimos: Record<string, string[]>): Record<string, number> {
  const mapa: Record<string, number> = {}
  cabecalho.forEach((c, i) => {
    const n = normalizar(texto(c))
    for (const [campo, nomes] of Object.entries(sinonimos)) {
      if (mapa[campo] === undefined && nomes.some((x) => n === x || n.startsWith(`${x} `))) { mapa[campo] = i; return }
    }
  })
  return mapa
}

/** "1.234,5" → 1234.5; "12" → 12 */
export function numero(v: Valor): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  const t = String(v).trim().replace(/\s/g, '')
  const n = Number(/,\d{1,3}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Data da planilha → "aaaa-mm-dd" (aceita data do Excel, 31/12/2026 e 2026-12-31). */
export function dataIso(v: Valor): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const t = String(v).trim()
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (br) { const ano = br[3].length === 2 ? `20${br[3]}` : br[3]; return `${ano}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}` }
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)
  return null
}

export const simNao = (v: Valor) => /^(s|sim|yes|y|true|1|x|aceita|aceito)$/i.test(texto(v).trim())
export const textoDe = texto
