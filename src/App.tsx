import { useState } from 'react'
import { BrowserRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Menu } from './components/Menu'
import { BarraSuperior } from './components/BarraSuperior'
import { Inicio } from './pages/Inicio'
import { Kanban } from './pages/Kanban'
import { Clientes } from './pages/Clientes'
import { Equipe } from './pages/Equipe'
import { Eventos } from './pages/eventos/Eventos'
import { Empresas } from './pages/eventos/Empresas'
import { EmpresaDetalhe } from './pages/eventos/EmpresaDetalhe'
import { Parcerias } from './pages/eventos/Parcerias'
import { Agenda } from './pages/eventos/Agenda'
import { Campanhas } from './pages/eventos/Campanhas'
import { CampanhaEditor } from './pages/eventos/CampanhaEditor'
import { Leads } from './pages/eventos/Leads'
import { Convite } from './pages/Convite'
import { FormularioPublico } from './pages/FormularioPublico'
import { EmConstrucao } from './pages/EmConstrucao'
import { Entrar } from './pages/Entrar'
import { PrimeiroAcesso } from './pages/PrimeiroAcesso'
import { ProvedorSessao, useSessao } from './lib/sessao'
import { ProvedorFoco } from './lib/foco'
import { FocoFlutuante } from './components/FocoFlutuante'
import { Estoque } from './pages/Estoque'
import { PainelTv } from './pages/PainelTv'

/** Campanhas e leads: quem não tem acesso a leads (ex.: jovem aprendiz) nem vê a tela. O banco também bloqueia. */
function SoComLeads({ children }: { children: React.ReactNode }) {
  const { acessoLeads } = useSessao()
  return acessoLeads ? <>{children}</> : <p className="texto-2">Você não tem acesso a campanhas e leads. Fale com um administrador se precisar.</p>
}

const CHAVE_MENU = 'luminy.menu.recolhido'
function lerMenu() { try { return localStorage.getItem(CHAVE_MENU) === '1' } catch { return false } }

function Painel() {
  const { estado, aviso } = useSessao()
  const [recolhido, setRecolhido] = useState(lerMenu)
  const [expandindo, setExpandindo] = useState(false)
  const { pathname } = useLocation()
  function alternarMenu() {
    if (recolhido) { setExpandindo(true); setTimeout(() => setExpandindo(false), 700) }
    setRecolhido((r) => { try { localStorage.setItem(CHAVE_MENU, r ? '0' : '1') } catch { /* sem armazenamento */ } return !r })
  }
  if (estado === 'carregando') return <div className="carregando">Carregando…</div>
  if (estado === 'deslogado') return <Entrar />
  if (estado === 'primeiro_acesso') return <PrimeiroAcesso />
  return (
    <ProvedorFoco>
      <div className={`app${recolhido ? ' app--recolhido' : ''}${expandindo ? ' app--expandindo' : ''}`}>
        <Menu recolhido={recolhido} alternar={alternarMenu} />
        <div className="conteudo">
          <BarraSuperior />
          {aviso && <p className="faixa-aviso" role="status">{aviso}</p>}
          <main key={pathname.split("/")[1]} className="pagina-entra"><Outlet /></main>
        </div>
      </div>
      <FocoFlutuante />
    </ProvedorFoco>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ProvedorSessao>
        <Routes>
          {/* Páginas abertas, sem o menu: formulário do QR e convite de equipe */}
          <Route path="/q/:slug" element={<FormularioPublico />} />
          <Route path="/convite/:token" element={<Convite />} />
          <Route path="/tv/:token" element={<PainelTv />} />
          <Route element={<Painel />}>
            <Route index element={<Inicio />} />
            <Route path="kanban" element={<Kanban />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="eventos" element={<Eventos />}>
              <Route index element={<Empresas />} />
              <Route path="empresas/:id" element={<EmpresaDetalhe />} />
              <Route path="parcerias" element={<Parcerias />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="campanhas" element={<SoComLeads><Campanhas /></SoComLeads>} />
              <Route path="campanhas/:id" element={<SoComLeads><CampanhaEditor /></SoComLeads>} />
              <Route path="leads" element={<SoComLeads><Leads /></SoComLeads>} />
            </Route>
            <Route path="estoque" element={<Estoque />} />
            <Route path="configuracoes" element={<Equipe />} />
            <Route path="*" element={<EmConstrucao />} />
          </Route>
        </Routes>
      </ProvedorSessao>
    </BrowserRouter>
  )
}
