import { useRef, useState } from 'react'
import { CheckCircle2, Link2, Upload } from 'lucide-react'
import { Janela } from '../../components/Janela'
import { Botao } from '../../components/ui'
import { exportarExcel, lerArquivo, lerGoogle, type Valor } from '../../lib/planilhas'
import { lerVerbas, type LeituraVerba } from '../../lib/verbaPlanilha'
import { MODELO_VERBAS } from '../../lib/modelos'
import { definirVerbas, reais, type Verba } from '../../lib/negocios'

const nomeMes = (iso: string) => { const t = new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1) }

/** Importa a verba de cada mês. Entende meses em linhas ou em colunas, com ou sem categorias. */
export function ImportarVerbas({ clienteId, atuais, onFechar, onImportado }: { clienteId: string; atuais: Verba[]; onFechar: () => void; onImportado: () => Promise<void> }) {
  const [anoAtual] = useState(() => new Date().getFullYear())
  const [ano, setAno] = useState(() => (new Date().getMonth() >= 9 ? new Date().getFullYear() + 1 : new Date().getFullYear()))
  const [linhas, setLinhas] = useState<{ dados: Valor[][]; origem: string } | null>(null)
  const [leitura, setLeitura] = useState<LeituraVerba | null>(null)
  const [fora, setFora] = useState<Set<string>>(new Set())
  const [link, setLink] = useState('')
  const [lendo, setLendo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [feito, setFeito] = useState<string | null>(null)
  const entrada = useRef<HTMLInputElement>(null)

  function entender(dados: Valor[][], origem: string, a = ano) {
    setErro(null)
    try { setLeitura(lerVerbas(dados, a)); setLinhas({ dados, origem }); setFora(new Set()) } catch (e) { setErro((e as Error).message); setLeitura(null) }
  }
  async function ler(f: () => Promise<Valor[][]>, origem: string) {
    setLendo(true); setErro(null)
    try { entender(await f(), origem) } catch (e) { setErro((e as Error).message) }
    setLendo(false)
  }
  const escolhidos = (leitura?.meses ?? []).filter((m) => !fora.has(m.mes))
  async function importar() {
    setEnviando(true); setErro(null)
    try {
      await definirVerbas(clienteId, escolhidos.map((m) => ({ mes: m.mes, valor: m.valor })))
      await onImportado()
      setFeito(`Verba de ${escolhidos.length} ${escolhidos.length === 1 ? 'mês importada' : 'meses importada'}.`)
    } catch (e) { setErro((e as Error).message) }
    setEnviando(false)
  }

  return (
    <Janela titulo="Importar verba dos meses" onFechar={onFechar} largura={720}>
      <div className="janela__corpo importar">
        {feito ? (
          <div className="importar__fim"><CheckCircle2 size={44} /><strong>{feito}</strong><Botao onClick={onFechar}>Fechar</Botao></div>
        ) : !leitura ? (
          <>
            <p className="faixa-dica">Pode ser a planilha que vocês já usam: os meses em linhas (Mês | Verba) ou em colunas (Jan, Fev, Mar…). Se tiver uma linha por categoria, eu somo; se tiver uma linha Total, uso ela.</p>
            <div className="linha" style={{ gap: 10 }}>
              <span className="pequeno">Ano dos meses que não dizem o ano:</span>
              <div className="segmentos" role="radiogroup" aria-label="Ano">
                {[anoAtual, anoAtual + 1].map((a) => <button key={a} type="button" role="radio" aria-checked={ano === a} className={ano === a ? 'marcado' : ''} onClick={() => setAno(a)}>{a}</button>)}
              </div>
            </div>
            <div className={`importar__soltar${arrastando ? ' ativo' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setArrastando(true) }} onDragLeave={() => setArrastando(false)}
              onDrop={(e) => { e.preventDefault(); setArrastando(false); const f = e.dataTransfer.files[0]; if (f) void ler(() => lerArquivo(f), f.name) }}
              onClick={() => entrada.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') entrada.current?.click() }}>
              <Upload size={28} />
              <strong>{lendo ? 'Lendo a planilha…' : 'Solte aqui o arquivo ou clique para escolher'}</strong>
              <span className="pequeno">Excel (.xlsx) ou CSV</span>
            </div>
            <input ref={entrada} type="file" hidden accept=".xlsx,.csv,.tsv,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) void ler(() => lerArquivo(f), f.name); e.target.value = '' }} />
            <div className="importar__ou"><span>ou pelo Google Planilhas</span></div>
            <form className="linha" onSubmit={(e) => { e.preventDefault(); void ler(() => lerGoogle(link), 'Google Planilhas') }}>
              <span className="importar__google"><Link2 size={16} /></span>
              <input className="entrada" style={{ flex: 1 }} value={link} onChange={(e) => setLink(e.target.value)} placeholder="Cole o link da planilha do Google" aria-label="Link do Google Planilhas" />
              <Botao type="submit" variante="secundario" disabled={!link.trim() || lendo}>Ler planilha</Botao>
            </form>
            <button type="button" className="anexo__acao" style={{ alignSelf: 'flex-start' }} onClick={() => void exportarExcel(MODELO_VERBAS, 'Modelo verba do marketing')}>Baixar a planilha modelo</button>
          </>
        ) : (
          <>
            <div className="importar__resumo">
              <div><strong>{escolhidos.length}</strong><span>{escolhidos.length === 1 ? 'mês para importar' : 'meses para importar'}</span></div>
              <span className="pequeno" style={{ marginLeft: 'auto' }}>de {linhas?.origem} · meses em {leitura.formato}</span>
            </div>
            {leitura.avisos.map((a) => <p key={a} className="faixa-dica">{a}</p>)}
            <div className="importar__previa">
              <table>
                <thead><tr><th /><th>Mês</th><th>Na planilha</th><th>Hoje no Luminy</th><th /></tr></thead>
                <tbody>{leitura.meses.map((m) => {
                  const atual = atuais.find((v) => v.mes === m.mes)?.valor
                  const marcado = !fora.has(m.mes)
                  return (
                    <tr key={m.mes} style={marcado ? undefined : { opacity: .45 }}>
                      <td><input type="checkbox" aria-label={`Importar ${nomeMes(m.mes)}`} checked={marcado} onChange={() => { const n = new Set(fora); if (marcado) n.add(m.mes); else n.delete(m.mes); setFora(n) }} /></td>
                      <td>{nomeMes(m.mes)}</td>
                      <td><strong>{reais(m.valor)}</strong>{m.detalhe && <small className="pequeno"> · {m.detalhe}</small>}</td>
                      <td>{atual == null ? '—' : reais(atual)}</td>
                      <td>{atual == null ? <span className="chip chip--sucesso">Novo</span> : atual === m.valor ? <span className="chip chip--neutro">Igual</span> : <span className="chip chip--alerta">Substitui</span>}</td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
            <div className="linha" style={{ justifyContent: 'space-between' }}>
              <div className="linha" style={{ gap: 4 }}>
                <Botao variante="fantasma" onClick={() => { setLeitura(null); setLinhas(null); setErro(null) }}>Escolher outra planilha</Botao>
                {linhas && <Botao variante="fantasma" onClick={() => { const a = ano === anoAtual ? anoAtual + 1 : anoAtual; setAno(a); entender(linhas.dados, linhas.origem, a) }}>Usar {ano === anoAtual ? anoAtual + 1 : anoAtual} nos meses sem ano</Botao>}
              </div>
              <Botao disabled={!escolhidos.length || enviando} onClick={() => void importar()}>{enviando ? 'Importando…' : `Importar ${escolhidos.length} ${escolhidos.length === 1 ? 'mês' : 'meses'}`}</Botao>
            </div>
          </>
        )}
        {erro && <p className="importar__erro" role="alert">{erro}</p>}
      </div>
    </Janela>
  )
}
