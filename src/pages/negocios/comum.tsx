/* eslint-disable react-refresh/only-export-components */
import { useRef, useState } from 'react'
import { FileText, Package, Paperclip, Shapes, Signpost, Star, Ticket, Wrench, X } from 'lucide-react'
import { Selecao, type Opcao } from '../../components/Selecao'
import { CATEGORIAS, type ReferenteTipo, abrirArquivo, enviarArquivo, lerValor, nomeArquivo, type Fornecedor } from '../../lib/negocios'

const bolinha = (cor: string) => <span className="bolinha-cor" style={{ background: cor }} />
export const opcoesCategoriaGasto: Opcao[] = [{ valor: '', rotulo: 'Sem categoria' }, ...CATEGORIAS.map((c) => ({ valor: c.nome, rotulo: c.nome, icone: bolinha(c.cor) }))]

export function opcoesFornecedor(fornecedores: Fornecedor[], vazio = 'Sem fornecedor'): Opcao[] {
  return [{ valor: '', rotulo: vazio }, ...fornecedores.filter((f) => f.ativo).map((f) => ({ valor: f.id, rotulo: f.nome, descricao: f.categoria ?? undefined }))]
}
export function SeletorFornecedor({ id, valor, onMudar, fornecedores, vazio }: { id?: string; valor: string; onMudar: (v: string) => void; fornecedores: Fornecedor[]; vazio?: string }) {
  return <Selecao id={id} valor={valor} onMudar={onMudar} opcoes={opcoesFornecedor(fornecedores, vazio)} busca={fornecedores.length > 6} />
}

/** Campo de valor em reais: aceita "1.250,90", "1250,9" ou "1250.90". */
export function CampoValor({ id, valor, onMudar, autoFocus }: { id: string; valor: string; onMudar: (v: string) => void; autoFocus?: boolean }) {
  return (
    <span className="campo-valor">
      <span aria-hidden>R$</span>
      <input id={id} inputMode="decimal" className="entrada" value={valor} autoFocus={autoFocus} placeholder="0,00" onChange={(e) => onMudar(e.target.value)}
        onBlur={() => { const n = lerValor(valor); if (n != null) onMudar(n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) }} />
    </span>
  )
}
export const valorParaCampo = (n: number | null | undefined) => (n == null ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

/** Anexar um arquivo (PDF do contrato, proposta, comprovante) ao armazenamento privado. */
export function CampoArquivo({ clienteId, pasta, caminho, onMudar, rotulo }: { clienteId: string; pasta: 'contratos' | 'cotacoes' | 'comprovantes' | 'notas'; caminho: string | null; onMudar: (c: string | null) => void; rotulo: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  return (
    <div className="campo-arquivo">
      {caminho ? (
        <span className="campo-arquivo__item">
          <button type="button" className="campo-arquivo__abrir" onClick={() => void abrirArquivo(caminho)}><FileText size={15} /> {nomeArquivo(caminho)}</button>
          <button type="button" className="icone-botao" style={{ width: 26, height: 26, border: 0 }} aria-label="Tirar arquivo" onClick={() => onMudar(null)}><X size={13} /></button>
        </span>
      ) : (
        <button type="button" className="botao botao--secundario botao--mini" disabled={enviando} onClick={() => input.current?.click()}><Paperclip size={14} /> {enviando ? 'Enviando…' : rotulo}</button>
      )}
      <input ref={input} type="file" hidden accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
        onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = ''
          if (!f) return
          setEnviando(true); setErro(null)
          try { onMudar(await enviarArquivo(clienteId, pasta, f)) } catch (x) { setErro((x as Error).message) }
          setEnviando(false)
        }} />
      {erro && <span className="importar__erro">{erro}</span>}
    </div>
  )
}

export function Estrelas({ nota, onMudar, tamanho = 16 }: { nota: number | null; onMudar?: (n: number | null) => void; tamanho?: number }) {
  return (
    <span className="estrelas" role={onMudar ? 'radiogroup' : undefined} aria-label={nota ? `${nota} de 5` : 'Sem avaliação'}>
      {[1, 2, 3, 4, 5].map((n) => onMudar
        ? <button key={n} type="button" role="radio" aria-checked={nota === n} aria-label={`${n} estrela${n > 1 ? 's' : ''}`} onClick={() => onMudar(nota === n ? null : n)}><Star size={tamanho} className={nota && n <= nota ? 'cheia' : ''} /></button>
        : <Star key={n} size={tamanho} className={nota && n <= nota ? 'cheia' : ''} aria-hidden />)}
    </span>
  )
}

export const ICONE_REFERENTE: Record<ReferenteTipo, React.ElementType> = { outdoor: Signpost, evento: Ticket, material: Package, servico: Wrench, outro: Shapes }
