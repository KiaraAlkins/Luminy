import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { criarConvenio, useConvenios } from '../lib/convenios'
import { useSessao } from '../lib/sessao'

const CORES = ['#0E9384', '#2E90FA', '#E5484D', '#12A15F', '#E8890C', '#7A5AF8', '#D6297A']

/** Logo do plano de saúde; sem logo, mostra as iniciais. */
export function LogoConvenio({ nome, tamanho = 22 }: { nome: string; tamanho?: number }) {
  const { porNome } = useConvenios()
  const c = porNome(nome)
  const estilo = { width: tamanho, height: tamanho, borderRadius: Math.round(tamanho * 0.25) }
  if (c?.foto_url) return <img className="logo-convenio" src={c.foto_url} alt="" style={estilo} loading="lazy" />
  const base = c?.nome ?? nome
  const ini = base.split(/[\s/]+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
  const cor = CORES[[...base].reduce((s, ch) => s + ch.charCodeAt(0), 0) % CORES.length]
  return <span className="logo-convenio logo-convenio--iniciais" aria-hidden style={{ ...estilo, background: cor, fontSize: Math.max(8, tamanho * 0.4) }}>{ini}</span>
}

/** Plano de saúde como etiqueta: logo + nome. */
export function ChipConvenio({ nome }: { nome: string }) {
  return <span className="chip-convenio"><LogoConvenio nome={nome} tamanho={18} />{nome}</span>
}

/** Vários planos de uma vez (ex.: plano dos funcionários de uma empresa): toca no logo para marcar. */
export function SeletorConvenios({ valor, onMudar, rotulo = 'Planos de saúde dos funcionários' }: { valor: string[]; onMudar: (v: string[]) => void; rotulo?: string }) {
  const { convenios, recarregar } = useConvenios()
  const { cliente } = useSessao()
  const [novo, setNovo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const alternar = (n: string) => onMudar(valor.includes(n) ? valor.filter((x) => x !== n) : [...valor, n])
  const avulsos = valor.filter((v) => !convenios.some((c) => c.nome === v))

  async function cadastrar() {
    const n = novo.trim()
    if (!n || !cliente) return
    setErro(null)
    try { await criarConvenio(cliente.id, n); await recarregar(); if (!valor.includes(n)) onMudar([...valor, n]); setNovo('') }
    catch (e) { setErro((e as Error).message) }
  }

  return (
    <div className="campo">
      <span className="pequeno" style={{ color: 'var(--texto-2)' }}>{rotulo}</span>
      <div className="grade-convenios" role="group" aria-label={rotulo}>
        {[...convenios.map((c) => c.nome), ...avulsos].map((n) => {
          const marcado = valor.includes(n)
          return (
            <button key={n} type="button" className={`convenio-opcao${marcado ? ' marcado' : ''}`} aria-pressed={marcado} onClick={() => alternar(n)}>
              <LogoConvenio nome={n} tamanho={30} />
              <span>{n}</span>
              {marcado && <Check size={14} className="convenio-opcao__ok" />}
            </button>
          )
        })}
      </div>
      <div className="linha">
        <input className="entrada" style={{ flex: 1 }} placeholder="Plano que não está na lista" value={novo} onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void cadastrar() } }} aria-label="Cadastrar outro plano" />
        <button type="button" className="botao botao--secundario" onClick={() => void cadastrar()} disabled={!novo.trim()}><Plus size={15} /> Cadastrar</button>
      </div>
      {erro && <p className="pequeno" style={{ color: 'var(--perigo)' }}>{erro}</p>}
      <span className="pequeno">Logos e nomes ficam em <Link to="/eventos/planos">Planos de saúde</Link>.</span>
    </div>
  )
}
