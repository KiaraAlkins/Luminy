import { useState, type FormEvent } from 'react'
import logo from '../assets/luminy-logo.svg'
import { supabase } from '../lib/supabase'
import './entrar.css'

// Liga quando o Google estiver configurado no Supabase (Authentication > Providers > Google)
const LOGIN_GOOGLE = import.meta.env.VITE_LOGIN_GOOGLE === 'true'

export function Entrar() {
  const [modo, setModo] = useState<'entrar' | 'criar' | 'esqueci'>('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [aviso, setAviso] = useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrarComGoogle() {
    if (!supabase) return
    setAviso(null)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) setAviso({ tipo: 'erro', texto: /not enabled|unsupported provider/i.test(error.message)
      ? 'O login com Google ainda está sendo configurado. Use o e-mail por enquanto.' : traduzir(error.message) })
  }

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
          {LOGIN_GOOGLE && modo !== 'esqueci' && (
            <>
              <button className="botao botao--secundario botao-google" type="button" onClick={() => void entrarComGoogle()}>
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
                Continuar com Google
              </button>
              <div className="entrar__ou"><span>ou com e-mail</span></div>
            </>
          )}
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
