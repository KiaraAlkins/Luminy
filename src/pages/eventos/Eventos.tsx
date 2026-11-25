import { Outlet, useLocation } from 'react-router-dom'
import { useSessao } from '../../lib/sessao'
import './eventos.css'

const TITULOS: [RegExp, string, string][] = [
  [/^\/eventos\/parcerias/, 'Parcerias', 'Arraste cada empresa pelas etapas, da prospecção à parceria ativa'],
  [/^\/eventos\/agenda/, 'Agenda de eventos', 'Mutirões, palestras e ações nas empresas parceiras'],
  [/^\/eventos\/campanhas\/.+/, '', ''],
  [/^\/eventos\/campanhas/, 'Campanhas QR', 'Monte o formulário, baixe o QR e acompanhe quantos viram lead'],
  [/^\/eventos\/leads/, 'Leads', 'Quem preencheu os formulários dos QR · dados sigilosos'],
  [/^\/eventos\/empresas\/.+/, '', ''],
  [/^\/eventos/, 'Empresas', 'Empresas parceiras, os planos de saúde dos funcionários e tudo que já foi feito com cada uma'],
]

/** Guia Eventos: cada página (Empresas, Parcerias, Agenda, Campanhas QR, Leads) fica no menu lateral. */
export function Eventos() {
  const { cliente } = useSessao()
  const { pathname } = useLocation()
  if (!cliente) return <div className="corpo"><h2>Eventos</h2><p className="texto-2">Crie um cliente primeiro.</p></div>
  const [, titulo, sub] = TITULOS.find(([r]) => r.test(pathname)) ?? [null, '', '']
  return (
    <div className="corpo">
      {titulo && <div><h2>{titulo}</h2><p className="pequeno">{sub}</p></div>}
      <Outlet />
    </div>
  )
}
