import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom'
import { Menu } from './components/Menu'
import { BarraSuperior } from './components/BarraSuperior'
import { Inicio } from './pages/Inicio'
import { Kanban } from './pages/Kanban'
import { FormularioPublico } from './pages/FormularioPublico'
import { EmConstrucao } from './pages/EmConstrucao'
import { Entrar } from './pages/Entrar'
import { PrimeiroAcesso } from './pages/PrimeiroAcesso'
import { ProvedorSessao, useSessao } from './lib/sessao'

function Painel() {
  const { estado } = useSessao()
  if (estado === 'carregando') return <div className="carregando">Carregando…</div>
  if (estado === 'deslogado') return <Entrar />
  if (estado === 'primeiro_acesso') return <PrimeiroAcesso />
  return (
    <div className="app">
      <Menu />
      <div className="conteudo">
        <BarraSuperior />
        <main><Outlet /></main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ProvedorSessao>
        <Routes>
          {/* Formulário público do QR: aberto, sem login e sem o menu da agência */}
          <Route path="/q/:slug" element={<FormularioPublico />} />
          <Route element={<Painel />}>
            <Route index element={<Inicio />} />
            <Route path="kanban" element={<Kanban />} />
            <Route path="*" element={<EmConstrucao />} />
          </Route>
        </Routes>
      </ProvedorSessao>
    </BrowserRouter>
  )
}
