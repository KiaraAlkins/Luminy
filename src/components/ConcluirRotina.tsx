import { useState } from 'react'
import { Camera, Check } from 'lucide-react'
import { Janela } from './Janela'
import { Botao } from './ui'
import { comemorar } from '../lib/comemorar'
import { marcarFeito, type Ocorrencia } from '../lib/rotinas'

/** Concluir uma rotina que tem checklist e/ou pede foto de comprovação. */
export function ConcluirRotina({ ocorrencia: o, usuarioId, onFechar, onFeito }: { ocorrencia: Ocorrencia; usuarioId: string; onFechar: () => void; onFeito: () => Promise<void> }) {
  const r = o.rotina
  const [itens, setItens] = useState<string[]>([])
  const [foto, setFoto] = useState<File | null>(null)
  const [obs, setObs] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const faltaFoto = r.exige_foto && !foto
  const alternar = (id: string) => setItens(itens.includes(id) ? itens.filter((x) => x !== id) : [...itens, id])

  async function concluir() {
    setEnviando(true); setErro(null)
    try { await marcarFeito(o, { itens, foto, observacao: obs }, usuarioId); comemorar(); await onFeito(); onFechar() }
    catch (e) { setErro((e as Error).message); setEnviando(false) }
  }

  return (
    <Janela titulo={`Rotina${o.horario ? ` das ${o.horario}` : ''}`} onFechar={onFechar} largura={520}>
      <div className="janela__corpo concluir-rotina">
        <div><h3 style={{ margin: 0 }}>{r.titulo}</h3>{r.descricao && <p className="texto-2" style={{ margin: '6px 0 0' }}>{r.descricao}</p>}</div>
        {r.checklist.length > 0 && (
          <ul className="checklist">
            {r.checklist.map((c) => (
              <li key={c.id} className={itens.includes(c.id) ? 'feito' : ''}>
                <label><input type="checkbox" checked={itens.includes(c.id)} onChange={() => alternar(c.id)} /><span>{c.texto}</span></label>
              </li>
            ))}
          </ul>
        )}
        <label className={`foto-rotina${foto ? ' com-foto' : ''}${r.exige_foto && !foto ? ' obrigatoria' : ''}`}>
          {foto ? <img src={URL.createObjectURL(foto)} alt="" /> : <Camera size={22} />}
          <span><strong>{foto ? 'Foto anexada' : r.exige_foto ? 'Foto de comprovação (obrigatória)' : 'Foto (opcional)'}</strong><small>{foto ? 'Toque para trocar' : 'Tire ou escolha uma foto'}</small></span>
          <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
        </label>
        <textarea className="entrada" rows={2} placeholder="Observação (opcional). Ex.: UTI sem movimento hoje" value={obs} onChange={(e) => setObs(e.target.value)} aria-label="Observação" />
        {erro && <p className="importar__erro">{erro}</p>}
        <div className="linha" style={{ justifyContent: 'flex-end' }}>
          <Botao variante="fantasma" onClick={onFechar}>Cancelar</Botao>
          <Botao icone={<Check size={16} />} disabled={faltaFoto || enviando} onClick={() => void concluir()}>{enviando ? 'Salvando…' : 'Concluir'}</Botao>
        </div>
      </div>
    </Janela>
  )
}
