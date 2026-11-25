import { NavLink, Outlet } from 'react-router-dom'
import { useSessao } from '../../lib/sessao'
import './eventos.css'

/** Aba Eventos e parcerias: empresas (CRM), quadro de parcerias, eventos, campanhas QR e leads. */
export function Eventos() {
  const { cliente, acessoLeads } = useSessao()
  if (!cliente) return <div className="corpo"><h2>Eventos e parcerias</h2><p className="texto-2">Crie um cliente primeiro.</p></div>
  const abas = [
    { para: '/eventos', nome: 'Empresas', fim: true },
    { para: '/eventos/parcerias', nome: 'Parcerias' },
    { para: '/eventos/agenda', nome: 'Eventos' },
    ...(acessoLeads ? [{ para: '/eventos/campanhas', nome: 'Campanhas QR' }, { para: '/eventos/leads', nome: 'Leads' }] : []),
  ]
  return (
    <div className="corpo">
      <div>
        <h2>Eventos e parcerias</h2>
        <p className="pequeno">Empresas parceiras do {cliente.nome}, os planos de saúde dos funcionários e tudo que já foi feito com cada uma</p>
      </div>
      <nav className="abas" aria-label="Seções de eventos e parcerias">
        {abas.map((a) => (
          <NavLink key={a.para} to={a.para} end={a.fim} className={({ isActive }) => `aba${isActive ? ' ativa' : ''}`}>{a.nome}</NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
