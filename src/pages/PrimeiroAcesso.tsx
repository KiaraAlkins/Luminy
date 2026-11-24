import { useState, type FormEvent } from 'react'
import logo from '../assets/luminy-logo.svg'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import './entrar.css'

/** Primeiro acesso: o dono cria a agência e o primeiro cliente; quem foi convidado aguarda ser adicionado. */
export function PrimeiroAcesso() {
  const { usuario, agencia, recarregar, sair } = useSessao()
  const [nomeAgencia, setNomeAgencia] = useState('Luminy')
  const [nomeCliente, setNomeCliente] = useState('Hospital Santa Marta')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [modo, setModo] = useState<'escolher' | 'criar'>(agencia ? 'criar' : 'escolher')

  async function criar(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setEnviando(true)
    setErro(null)
    const ag = await supabase.rpc('iniciar_agencia', { p_nome: nomeAgencia })
    const cl = ag.error ? ag : await supabase.rpc('criar_cliente', { p_agencia: ag.data, p_nome: nomeCliente, p_cor: '#E5484D' })
    setEnviando(false)
    if (cl.error) { setErro('Não foi possível criar. Tente de novo.'); return }
    await recarregar()
  }

  return (
    <main className="entrar" style={{ gridTemplateColumns: '1fr' }}>
      <section className="entrar__painel">
        <div className="entrar__cartao" style={{ maxWidth: 440 }}>
          <img src={logo} alt="Luminy" style={{ height: 40, alignSelf: 'flex-start' }} />
          <h2>Olá, {usuario.nome.split(' ')[0] || 'tudo bem'}</h2>
          {modo === 'escolher' ? (
            <>
              <p className="texto-2">Sua conta está pronta. Se você faz parte da equipe de um cliente, peça para o administrador te adicionar pelo seu e-mail.</p>
              <button className="botao botao--secundario" type="button" onClick={() => void recarregar()}>Já fui adicionado, atualizar</button>
              <button className="botao botao--fantasma" type="button" onClick={() => setModo('criar')}>Sou dono de uma agência</button>
              <button className="botao botao--fantasma" type="button" onClick={() => void sair()}>Sair</button>
            </>
          ) : (
            <form onSubmit={criar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p className="texto-2">Vamos criar sua agência e o primeiro cliente. Os demais você adiciona depois.</p>
              <div className="campo"><label htmlFor="agencia">Nome da agência</label>
                <input id="agencia" className="entrada" value={nomeAgencia} onChange={(e) => setNomeAgencia(e.target.value)} required /></div>
              <div className="campo"><label htmlFor="cliente">Primeiro cliente</label>
                <input id="cliente" className="entrada" value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} required /></div>
              {erro && <p className="entrar__aviso entrar__aviso--erro">{erro}</p>}
              <button className="botao botao--primario" type="submit" disabled={enviando}>{enviando ? 'Criando…' : 'Criar e começar'}</button>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}
