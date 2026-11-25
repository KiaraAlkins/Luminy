import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Camera, ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { Botao } from '../../components/ui'
import { LogoConvenio } from '../../components/Convenio'
import { useSessao } from '../../lib/sessao'
import { CONVENIOS_SUGERIDOS, listarEmpresas, type Empresa } from '../../lib/parcerias'
import { criarConvenio, excluirConvenio, renomearConvenio, trocarLogoConvenio, useConvenios, type Convenio } from '../../lib/convenios'

/** Planos de saúde que o cliente trabalha, com logo, para escolher nas empresas, campanhas e leads. */
export function PlanosSaude() {
  const { cliente, ehAdminCliente } = useSessao()
  const { convenios, recarregar } = useConvenios()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [nome, setNome] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [previa, setPrevia] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)

  const carregarEmpresas = useCallback(async () => { if (cliente) setEmpresas((await listarEmpresas(cliente.id)).empresas) }, [cliente])
  useEffect(() => { void Promise.resolve().then(carregarEmpresas) }, [carregarEmpresas])

  function escolher(f: File | undefined) {
    if (!f) return
    setArquivo(f); setPrevia(URL.createObjectURL(f))
  }

  async function cadastrar(e?: FormEvent, n = nome) {
    e?.preventDefault()
    if (!cliente || !n.trim()) return
    setSalvando(true); setErro(null)
    try { await criarConvenio(cliente.id, n, arquivo); setNome(''); setArquivo(null); setPrevia(null); await recarregar() }
    catch (err) { setErro((err as Error).message) }
    setSalvando(false)
  }

  const usados = (c: Convenio) => empresas.filter((e) => e.convenios.includes(c.nome)).length
  const sugestoes = CONVENIOS_SUGERIDOS.filter((s) => !convenios.some((c) => c.nome.toLowerCase() === s.toLowerCase()))

  return (
    <>
      <form className="cartao novo-plano" onSubmit={cadastrar}>
        <button type="button" className="novo-plano__logo" onClick={() => entrada.current?.click()} aria-label="Escolher logo do plano">
          {previa ? <img src={previa} alt="" /> : <><ImagePlus size={22} /><span>Logo</span></>}
        </button>
        <input ref={entrada} type="file" accept="image/*" hidden onChange={(e) => escolher(e.target.files?.[0])} />
        <div className="campo" style={{ flex: 1 }}>
          <label htmlFor="plano-nome">Novo plano de saúde</label>
          <input id="plano-nome" className="entrada" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Unimed, Cassi, Geap…" />
          {sugestoes.length > 0 && (
            <div className="linha" style={{ gap: 6 }}>
              <span className="pequeno">Cadastrar rápido:</span>
              {sugestoes.slice(0, 8).map((s) => <button key={s} type="button" className="opcao opcao--mini" onClick={() => void cadastrar(undefined, s)}><Plus size={12} /> {s}</button>)}
            </div>
          )}
        </div>
        <Botao type="submit" icone={<Plus size={16} />} disabled={!nome.trim() || salvando}>{salvando ? 'Salvando…' : 'Cadastrar'}</Botao>
      </form>
      {erro && <p className="pequeno" style={{ color: 'var(--perigo)' }}>{erro}</p>}

      <div className="grade-planos">
        {convenios.map((c) => <CartaoPlano key={c.id} convenio={c} usados={usados(c)} podeExcluir={ehAdminCliente} onMudou={async () => { await recarregar(); await carregarEmpresas() }} />)}
        {convenios.length === 0 && <p className="texto-2">Nenhum plano cadastrado ainda. Cadastre os planos que o hospital atende, com o logo de cada um.</p>}
      </div>
    </>
  )
}

function CartaoPlano({ convenio: c, usados, podeExcluir, onMudou }: { convenio: Convenio; usados: number; podeExcluir: boolean; onMudou: () => Promise<void> }) {
  const entrada = useRef<HTMLInputElement>(null)
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(c.nome)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function trocar(f: File | undefined) {
    if (!f) return
    setEnviando(true); setErro(null)
    try { await trocarLogoConvenio(c, f); await onMudou() } catch (e) { setErro((e as Error).message) }
    setEnviando(false)
  }
  async function renomear() {
    if (nome.trim() === c.nome) { setEditando(false); return }
    try { await renomearConvenio(c, nome); setEditando(false); await onMudou() } catch (e) { setErro((e as Error).message) }
  }

  return (
    <div className="plano">
      <button type="button" className={`plano__logo${enviando ? ' enviando' : ''}`} onClick={() => entrada.current?.click()} title="Trocar logo" aria-label={`Trocar logo de ${c.nome}`}>
        <LogoConvenio nome={c.nome} tamanho={64} />
        <span className="plano__trocar"><Camera size={16} /></span>
      </button>
      <input ref={entrada} type="file" accept="image/*" hidden onChange={(e) => void trocar(e.target.files?.[0])} />
      {editando ? (
        <form className="linha" style={{ gap: 6 }} onSubmit={(e) => { e.preventDefault(); void renomear() }}>
          <input className="entrada entrada--mini" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} onBlur={() => void renomear()} aria-label="Nome do plano" />
        </form>
      ) : (
        <strong className="plano__nome">{c.nome}</strong>
      )}
      <span className="pequeno">{usados ? `${usados} ${usados === 1 ? 'empresa usa' : 'empresas usam'}` : 'Nenhuma empresa ainda'}</span>
      {!c.foto_url && <span className="pequeno" style={{ color: 'var(--marca)' }}>Toque no círculo para pôr o logo</span>}
      {erro && <span className="pequeno" style={{ color: 'var(--perigo)' }}>{erro}</span>}
      <div className="plano__acoes">
        <button type="button" className="icone-botao" style={{ width: 30, height: 30, border: 0 }} aria-label={`Renomear ${c.nome}`} title="Renomear (atualiza nas empresas)" onClick={() => setEditando(true)}><Pencil size={14} /></button>
        {podeExcluir && <button type="button" className="icone-botao" style={{ width: 30, height: 30, border: 0 }} aria-label={`Excluir ${c.nome}`} title="Excluir"
          onClick={() => { if (confirm(`Excluir o plano ${c.nome}? As empresas que já usam continuam com o nome, só sem o logo.`)) void excluirConvenio(c).then(onMudou) }}><Trash2 size={14} /></button>}
      </div>
    </div>
  )
}
