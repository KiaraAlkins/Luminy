import { useState, type FormEvent } from 'react'
import logo from '../assets/luminy-logo.svg'
import { supabase } from '../lib/supabase'
import './entrar.css'

export function Entrar() {
  const [modo, setModo] = useState<'entrar' | 'criar' | 'esqueci'>('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [aviso, setAviso] = useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setAviso(null)
    setEnviando(true)
    const volta = window.location.origin
    const r = modo === 'entrar'
      ? await supabase.auth.signInWithPassword({ email, password: senha })
      : modo === 'criar'
        ? await supabase.auth.signUp({ email, password: senha, options: { data: { nome }, emailRedirectTo: volta } })
        : await supabase.auth.resetPasswordForEmail(email, { redirectTo: volta })
    setEnviando(false)
    if (r.error) {
      setAviso({ tipo: 'erro', texto: traduzir(r.error.message) })
    } else if (modo === 'criar') {
      setAviso({ tipo: 'ok', texto: 'Conta criada. Enviamos um link de confirmação para o seu e-mail.' })
    } else if (modo === 'esqueci') {
      setAviso({ tipo: 'ok', texto: 'Se houver uma conta com este e-mail, você vai receber o link para criar uma nova senha.' })
    }
  }

  return (
    <main className="entrar">
      <section className="entrar__marca">
        <img src={logo} alt="Luminy" className="entrar__logo" />
        <h1>Sua agência, organizada do jeito que a equipe trabalha.</h1>
        <p>Demandas, Kanban, calendário, campanhas com QR Code e leads num lugar só.</p>
      </section>

      <section className="entrar__painel">
        <form className="entrar__cartao" onSubmit={enviar}>
          <h2>{modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Recuperar senha'}</h2>
          {modo === 'criar' && (
            <div className="campo"><label htmlFor="nome">Seu nome</label>
              <input id="nome" className="entrada" value={nome} onChange={(e) => setNome(e.target.value)} required autoComplete="name" /></div>
          )}
          <div className="campo"><label htmlFor="email">E-mail</label>
            <input id="email" className="entrada" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></div>
          {modo !== 'esqueci' && (
            <div className="campo"><label htmlFor="senha">Senha</label>
              <input id="senha" className="entrada" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={8}
                autoComplete={modo === 'criar' ? 'new-password' : 'current-password'} /></div>
          )}
          {aviso && <p className={`entrar__aviso entrar__aviso--${aviso.tipo}`} role="status">{aviso.texto}</p>}
          <button className="botao botao--primario" type="submit" disabled={enviando}>
            {enviando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Enviar link'}
          </button>
          <div className="entrar__links">
            {modo !== 'entrar' && <button type="button" onClick={() => setModo('entrar')}>Já tenho conta</button>}
            {modo === 'entrar' && <button type="button" onClick={() => setModo('esqueci')}>Esqueci minha senha</button>}
            {modo !== 'criar' && <button type="button" onClick={() => setModo('criar')}>Criar conta</button>}
          </div>
        </form>
      </section>
    </main>
  )
}

function traduzir(msg: string) {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(msg)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.'
  if (/already registered/i.test(msg)) return 'Já existe uma conta com este e-mail.'
  if (/password should be/i.test(msg)) return 'A senha precisa ter pelo menos 8 caracteres.'
  if (/signups not allowed/i.test(msg)) return 'O cadastro está fechado. Peça um convite ao administrador.'
  return 'Não foi possível concluir. Tente de novo em instantes.'
}
