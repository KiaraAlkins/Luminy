import { useState, type FormEvent } from 'react'
import { ArrowLeft, Building2, Users } from 'lucide-react'
import logo from '../assets/luminy-logo.svg'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import './entrar.css'

/** Aceita o link inteiro do convite ou só o código. */
function extrairToken(texto: string) {
  const t = texto.trim()
  const m = t.match(/convite\/([a-f0-9]+)/i)
  return (m ? m[1] : t).replace(/[^a-f0-9]/gi, '')
}

/**
 * Primeiros passos: logo depois de criar a conta, a pessoa escolhe
 * entrar numa equipe existente (convite) ou criar a própria agência/equipe.
 */
export function PrimeiroAcesso() {
  const { usuario, recarregar, sair } = useSessao()
  const [caminho, setCaminho] = useState<'escolher' | 'equipe' | 'agencia'>('escolher')
  const [convite, setConvite] = useState('')
  const [nomeAgencia, setNomeAgencia] = useState('')
  const [nomeCliente, setNomeCliente] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const primeiroNome = usuario.nome.split(' ')[0]

  async function entrarNaEquipe(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setEnviando(true); setErro(null)
    const { error } = await supabase.rpc('aceitar_convite', { p_token: extrairToken(convite) })
    setEnviando(false)
    if (error) {
      setErro(/expirou/.test(error.message) ? 'Este convite expirou. Peça um novo ao administrador.'
        : /usado/.test(error.message) ? 'Este convite já foi usado.'
        : /outro e-mail/.test(error.message) ? 'Este convite foi enviado para outro e-mail. Entre com a conta desse e-mail.'
        : 'Convite não encontrado. Confira o link ou o código.')
      return
    }
    await recarregar()
  }

  async function criarAgencia(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setEnviando(true); setErro(null)
    const ag = await supabase.rpc('iniciar_agencia', { p_nome: nomeAgencia })
    const cl = ag.error || !nomeCliente.trim() ? ag
      : await supabase.rpc('criar_cliente', { p_agencia: ag.data, p_nome: nomeCliente.trim(), p_cor: '#E5484D' })
    setEnviando(false)
    if (cl.error) { setErro('Não foi possível criar. Tente de novo.'); return }
    await recarregar()
  }

  return (
    <main className="primeiros-passos">
      <header className="primeiros-passos__topo">
        <img src={logo} alt="Luminy" />
        <button type="button" className="botao botao--fantasma" onClick={() => void sair()}>Sair</button>
      </header>

      <section className="primeiros-passos__corpo">
        <span className="rotulo">Primeiros passos</span>
        <h1>{primeiroNome ? `Que bom ter você aqui, ${primeiroNome}!` : 'Que bom ter você aqui!'}</h1>

        {caminho === 'escolher' && (
          <>
            <p className="texto-2">Como você vai usar o Luminy?</p>
            <div className="primeiros-passos__opcoes">
              <button type="button" className="opcao-grande" onClick={() => setCaminho('equipe')}>
                <span className="opcao-grande__icone"><Users size={24} /></span>
                <strong>Já tenho equipe</strong>
                <span className="texto-2">Recebi um convite para entrar na equipe de um cliente ou agência.</span>
              </button>
              <button type="button" className="opcao-grande" onClick={() => setCaminho('agencia')}>
                <span className="opcao-grande__icone"><Building2 size={24} /></span>
                <strong>Criar minha agência ou equipe</strong>
                <span className="texto-2">Vou organizar meus clientes e convidar as pessoas que trabalham comigo.</span>
              </button>
            </div>
          </>
        )}

        {caminho === 'equipe' && (
          <form className="primeiros-passos__form" onSubmit={entrarNaEquipe}>
            <button type="button" className="voltar" onClick={() => { setCaminho('escolher'); setErro(null) }}><ArrowLeft size={16} /> Voltar</button>
            <h2>Entrar na equipe</h2>
            <p className="texto-2">Cole o link do convite que você recebeu (por WhatsApp ou e-mail) ou só o código.</p>
            <div className="campo"><label htmlFor="convite">Link ou código do convite</label>
              <input id="convite" className="entrada" value={convite} onChange={(e) => setConvite(e.target.value)} required
                placeholder="https://luminy…/convite/…" /></div>
            {erro && <p className="entrar__aviso entrar__aviso--erro">{erro}</p>}
            <button className="botao botao--primario" type="submit" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar na equipe'}</button>
            <p className="pequeno">Não recebeu o convite? Peça ao administrador da equipe. Se ele convidou pelo seu e-mail, você entra sozinho ao criar a conta com esse e-mail.</p>
          </form>
        )}

        {caminho === 'agencia' && (
          <form className="primeiros-passos__form" onSubmit={criarAgencia}>
            <button type="button" className="voltar" onClick={() => { setCaminho('escolher'); setErro(null) }}><ArrowLeft size={16} /> Voltar</button>
            <h2>Criar sua agência ou equipe</h2>
            <div className="campo"><label htmlFor="agencia">Nome da agência ou equipe</label>
              <input id="agencia" className="entrada" value={nomeAgencia} onChange={(e) => setNomeAgencia(e.target.value)} required placeholder="Ex.: Luminy" /></div>
            <div className="campo"><label htmlFor="cliente">Primeiro cliente (opcional)</label>
              <input id="cliente" className="entrada" value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} placeholder="Ex.: Hospital Santa Marta" />
              <span className="pequeno">Cada cliente ganha o próprio Kanban, calendário, campanhas e equipe. Dá para adicionar outros depois.</span></div>
            {erro && <p className="entrar__aviso entrar__aviso--erro">{erro}</p>}
            <button className="botao botao--primario" type="submit" disabled={enviando}>{enviando ? 'Criando…' : 'Criar e começar'}</button>
          </form>
        )}
      </section>
    </main>
  )
}
