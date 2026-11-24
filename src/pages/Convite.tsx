import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import logo from '../assets/luminy-logo.svg'
import { supabase } from '../lib/supabase'
import { CHAVE_CONVITE, useSessao } from '../lib/sessao'
import './entrar.css'

type Info = { cliente: string; convidado_por: string | null; expirado: boolean; usado: boolean; email: string | null } | null

/** Página aberta pelo link do convite. Guarda o convite, pede login e aceita em seguida. */
export function Convite() {
  const { token = '' } = useParams()
  const { estado, recarregar } = useSessao()
  const navegar = useNavigate()
  const [info, setInfo] = useState<Info | undefined>(undefined)

  useEffect(() => {
    supabase?.rpc('ver_convite', { p_token: token }).then(({ data }) => setInfo((data as Info) ?? null))
  }, [token])

  async function aceitar() {
    try { localStorage.setItem(CHAVE_CONVITE, token) } catch { /* sem armazenamento */ }
    if (estado === 'pronto') { await recarregar(); navegar('/') } else navegar('/')
  }

  const invalido = info === null || info?.expirado || info?.usado
  return (
    <main className="entrar" style={{ gridTemplateColumns: '1fr' }}>
      <section className="entrar__painel">
        <div className="entrar__cartao" style={{ maxWidth: 440 }}>
          <img src={logo} alt="Luminy" style={{ height: 40, alignSelf: 'flex-start' }} />
          {info === undefined ? <p className="pequeno">Carregando convite…</p> : invalido ? (
            <>
              <h2>Convite indisponível</h2>
              <p className="texto-2">{info?.usado ? 'Este convite já foi usado.' : info?.expirado ? 'Este convite expirou.' : 'Não encontramos este convite.'} Peça um novo ao administrador.</p>
            </>
          ) : (
            <>
              <h2>Você foi convidado</h2>
              <p className="texto-2">{info.convidado_por ? `${info.convidado_por} convidou você` : 'Você foi convidado'} para a equipe do <strong>{info.cliente}</strong> no Luminy.</p>
              {info.email && <p className="pequeno">Entre ou crie a conta com o e-mail {info.email}.</p>}
              <button className="botao botao--primario" type="button" onClick={() => void aceitar()}>
                {estado === 'pronto' ? 'Entrar na equipe' : 'Entrar ou criar conta para aceitar'}
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
