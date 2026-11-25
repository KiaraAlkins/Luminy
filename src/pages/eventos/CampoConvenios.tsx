import { useState } from 'react'
import { X } from 'lucide-react'

/** Seleção dos planos de saúde: sugestões comuns com um clique e campo livre para outros. */
export function CampoConvenios({ valor, onMudar, sugestoes }: { valor: string[]; onMudar: (v: string[]) => void; sugestoes: string[] }) {
  const [outro, setOutro] = useState('')
  const alternar = (c: string) => onMudar(valor.includes(c) ? valor.filter((x) => x !== c) : [...valor, c])
  const adicionar = () => { const c = outro.trim(); if (c && !valor.includes(c)) onMudar([...valor, c]); setOutro('') }
  const extras = valor.filter((v) => !sugestoes.includes(v))
  return (
    <div className="campo">
      <span className="pequeno" style={{ color: 'var(--texto-2)' }}>Planos de saúde dos funcionários</span>
      <div className="linha">
        {sugestoes.map((c) => (
          <button key={c} type="button" className={`opcao${valor.includes(c) ? ' marcada' : ''}`} aria-pressed={valor.includes(c)} onClick={() => alternar(c)}>{c}</button>
        ))}
        {extras.map((c) => (
          <button key={c} type="button" className="opcao marcada" onClick={() => alternar(c)} aria-label={`Remover ${c}`}>{c} <X size={12} /></button>
        ))}
      </div>
      <div className="linha">
        <input className="entrada" style={{ flex: 1 }} placeholder="Outro plano" value={outro} onChange={(e) => setOutro(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar() } }} aria-label="Outro plano de saúde" />
        <button type="button" className="botao botao--secundario" onClick={adicionar}>Adicionar</button>
      </div>
    </div>
  )
}
