import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, ChevronDown, Download, FileDown, FileSpreadsheet, FileUp, Link2, Sheet, Upload } from 'lucide-react'
import { Janela } from './Janela'
import { Botao } from './ui'
import {
  abrirNoGoogle, exportarCsv, exportarExcel, lerArquivo, lerGoogle, mapearColunas, textoDe,
  type Tabela, type Valor,
} from '../lib/planilhas'

/** Botão "Planilha": exportar (Excel, CSV, Google Planilhas), importar e baixar o modelo. */
export function BotaoPlanilha({ nome, exportar, onImportar, modelo }: {
  nome: string; exportar?: () => Tabela; onImportar?: () => void; modelo?: Tabela
}) {
  const [aberto, setAberto] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const botao = useRef<HTMLButtonElement>(null)
  const painel = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, right: 0 })

  useEffect(() => {
    if (!aberto) return
    const r = botao.current!.getBoundingClientRect()
    setPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    const fora = (e: MouseEvent) => { if (!painel.current?.contains(e.target as Node) && !botao.current?.contains(e.target as Node)) setAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', fora); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [aberto])

  const agir = (f: () => unknown) => { setAberto(false); void Promise.resolve(f()) }
  const data = () => new Date().toISOString().slice(0, 10)
  return (
    <>
      <button ref={botao} type="button" className="botao botao--secundario" aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        <FileSpreadsheet size={16} /> Planilha <ChevronDown size={14} />
      </button>
      {aberto && createPortal(
        <div ref={painel} className="menu-acoes" role="menu" style={{ top: pos.top, right: pos.right }}>
          {exportar && <>
            <span className="rotulo">Exportar</span>
            <button type="button" role="menuitem" onClick={() => agir(() => exportarExcel(exportar(), `${nome} ${data()}`))}><FileDown size={16} /><span><strong>Excel (.xlsx)</strong><small>Abre no Excel e no Google Planilhas</small></span></button>
            <button type="button" role="menuitem" onClick={() => agir(() => exportarCsv(exportar(), `${nome} ${data()}`))}><Download size={16} /><span><strong>CSV</strong><small>Formato simples, abre em qualquer programa</small></span></button>
            <button type="button" role="menuitem" onClick={() => agir(async () => { await abrirNoGoogle(exportar()); setAviso('Copiado! Na planilha nova do Google, clique na célula A1 e aperte Ctrl+V.'); setTimeout(() => setAviso(null), 8000) })}>
              <Sheet size={16} /><span><strong>Google Planilhas</strong><small>Abre uma planilha nova: é só colar (Ctrl+V)</small></span></button>
          </>}
          {onImportar && <>
            <span className="rotulo">Importar</span>
            <button type="button" role="menuitem" onClick={() => agir(onImportar)}><Upload size={16} /><span><strong>Importar planilha</strong><small>Excel, CSV ou link do Google Planilhas</small></span></button>
          </>}
          {modelo && <button type="button" role="menuitem" onClick={() => agir(() => exportarExcel(modelo, `Modelo ${nome}`))}><FileUp size={16} /><span><strong>Baixar modelo</strong><small>Planilha com as colunas certas</small></span></button>}
        </div>, document.body)}
      {aviso && createPortal(<div className="aviso-flutuante" role="status"><span>{aviso}</span></div>, document.body)}
    </>
  )
}

export type Conversao<T> = { ok: true; item: T } | { ok: false; erro: string }

/**
 * Importar planilha em três passos: escolher (arquivo ou link do Google), conferir a prévia, confirmar.
 * Cada tela diz como achar as colunas (sinônimos) e como transformar cada linha.
 */
export function ImportarPlanilha<T>({ titulo, sinonimos, obrigatorias, converter, previa, enviar, onFechar, aviso, confirmacao, modelo, nome }: {
  titulo: string
  sinonimos: Record<string, string[]>
  /** Colunas que precisam existir (nomes dos campos) */
  obrigatorias: string[]
  converter: (linha: Valor[], mapa: Record<string, number>, cabecalho: Valor[]) => Conversao<T>
  previa: { rotulo: string; valor: (item: T) => ReactNode }[]
  enviar: (itens: T[], origem: string) => Promise<string>
  onFechar: () => void
  aviso?: ReactNode
  /** Caixa que a pessoa precisa marcar antes de importar (ex.: LGPD) */
  confirmacao?: string
  modelo: Tabela
  nome: string
}) {
  const [link, setLink] = useState('')
  const [lendo, setLendo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [dados, setDados] = useState<{ itens: T[]; erros: { linha: number; erro: string }[]; origem: string; achadas: string[] } | null>(null)
  const [confirmado, setConfirmado] = useState(!confirmacao)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)

  async function processar(ler: () => Promise<Valor[][]>, origem: string) {
    setErro(null); setLendo(true)
    try {
      const linhas = await ler()
      const inicio = linhas.findIndex((l) => l.filter((v) => textoDe(v).trim()).length >= 1)
      if (inicio < 0 || linhas.length - inicio < 2) throw new Error('A planilha está vazia ou só tem o cabeçalho.')
      const cabecalho = linhas[inicio]
      const mapa = mapearColunas(cabecalho, sinonimos)
      const faltam = obrigatorias.filter((c) => mapa[c] === undefined)
      if (faltam.length) throw new Error(`Não achei a coluna ${faltam.map((f) => `"${sinonimos[f]?.[0] ?? f}"`).join(' e ')}. Use o modelo ou renomeie a coluna na planilha.`)
      const itens: T[] = []; const erros: { linha: number; erro: string }[] = []
      linhas.slice(inicio + 1).forEach((l, i) => {
        if (!l.some((v) => textoDe(v).trim())) return
        const r = converter(l, mapa, cabecalho)
        if (r.ok) itens.push(r.item); else erros.push({ linha: inicio + i + 2, erro: r.erro })
      })
      setDados({ itens, erros, origem, achadas: Object.keys(mapa) })
    } catch (e) { setErro((e as Error).message) }
    setLendo(false)
  }

  async function confirmar() {
    if (!dados) return
    setEnviando(true); setErro(null)
    try { setResultado(await enviar(dados.itens, dados.origem)) } catch (e) { setErro((e as Error).message || 'Não foi possível importar.') }
    setEnviando(false)
  }

  return (
    <Janela titulo={titulo} onFechar={onFechar} largura={760}>
      <div className="janela__corpo importar">
        {resultado ? (
          <div className="importar__fim">
            <CheckCircle2 size={44} />
            <strong>{resultado}</strong>
            <Botao onClick={onFechar}>Fechar</Botao>
          </div>
        ) : !dados ? (
          <>
            {aviso}
            <div className={`importar__soltar${arrastando ? ' ativo' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setArrastando(true) }} onDragLeave={() => setArrastando(false)}
              onDrop={(e) => { e.preventDefault(); setArrastando(false); const f = e.dataTransfer.files[0]; if (f) void processar(() => lerArquivo(f), f.name) }}
              onClick={() => entrada.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') entrada.current?.click() }}>
              <Upload size={28} />
              <strong>{lendo ? 'Lendo a planilha…' : 'Solte aqui o arquivo ou clique para escolher'}</strong>
              <span className="pequeno">Excel (.xlsx) ou CSV</span>
            </div>
            <input ref={entrada} type="file" hidden accept=".xlsx,.csv,.tsv,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) void processar(() => lerArquivo(f), f.name); e.target.value = '' }} />
            <div className="importar__ou"><span>ou pelo Google Planilhas</span></div>
            <form className="linha" onSubmit={(e) => { e.preventDefault(); void processar(() => lerGoogle(link), 'Google Planilhas') }}>
              <span className="importar__google"><Link2 size={16} /></span>
              <input className="entrada" style={{ flex: 1 }} value={link} onChange={(e) => setLink(e.target.value)} placeholder="Cole o link da planilha do Google" aria-label="Link do Google Planilhas" />
              <Botao type="submit" variante="secundario" disabled={!link.trim() || lendo}>Ler planilha</Botao>
            </form>
            <p className="pequeno">A planilha do Google precisa estar em <em>Compartilhar › Qualquer pessoa com o link › Leitor</em>. Depois de importar, você pode voltar para restrito.</p>
            <button type="button" className="anexo__acao" style={{ alignSelf: 'flex-start' }} onClick={() => void exportarExcel(modelo, `Modelo ${nome}`)}>Baixar a planilha modelo</button>
          </>
        ) : (
          <>
            <div className="importar__resumo">
              <div><strong>{dados.itens.length}</strong><span>prontos para importar</span></div>
              {dados.erros.length > 0 && <div className="com-erro"><strong>{dados.erros.length}</strong><span>com problema (ficam de fora)</span></div>}
              <span className="pequeno" style={{ marginLeft: 'auto' }}>de {dados.origem}</span>
            </div>
            <div className="importar__previa">
              <table>
                <thead><tr>{previa.map((p) => <th key={p.rotulo}>{p.rotulo}</th>)}</tr></thead>
                <tbody>{dados.itens.slice(0, 8).map((it, i) => <tr key={i}>{previa.map((p) => <td key={p.rotulo}>{p.valor(it)}</td>)}</tr>)}</tbody>
              </table>
              {dados.itens.length > 8 && <p className="pequeno">e mais {dados.itens.length - 8}…</p>}
            </div>
            {dados.erros.length > 0 && (
              <details className="importar__erros"><summary>Ver linhas com problema</summary>
                <ul>{dados.erros.slice(0, 30).map((e) => <li key={e.linha}>Linha {e.linha}: {e.erro}</li>)}</ul></details>
            )}
            {confirmacao && (
              <label className="aceite"><input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} /><span>{confirmacao}</span></label>
            )}
            <div className="linha" style={{ justifyContent: 'space-between' }}>
              <Botao variante="fantasma" onClick={() => { setDados(null); setErro(null) }}>Escolher outra planilha</Botao>
              <Botao disabled={!dados.itens.length || !confirmado || enviando} onClick={() => void confirmar()}>{enviando ? 'Importando…' : `Importar ${dados.itens.length}`}</Botao>
            </div>
          </>
        )}
        {erro && <p className="importar__erro" role="alert">{erro}</p>}
      </div>
    </Janela>
  )
}
