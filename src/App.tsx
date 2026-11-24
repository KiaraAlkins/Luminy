import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom'
import { Menu } from './components/Menu'
import { BarraSuperior } from './components/BarraSuperior'
import { Inicio } from './pages/Inicio'
import { Kanban } from './pages/Kanban'
import { Clientes } from './pages/Clientes'
import { Equipe } from './pages/Equipe'
import { Convite } from './pages/Convite'
import { FormularioPublico } from './pages/FormularioPublico'
import { EmConstrucao } from './pages/EmConstrucao'
import { Entrar } from './pages/Entrar'
import { PrimeiroAcesso } from './pages/PrimeiroAcesso'
import { ProvedorSessao, useSessao } from './lib/sessao'

function Painel() {
  const { estado, aviso } = useSessao()
  if (estado === 'carregando') return <div className="carregando">Carregando…</div>
  if (estado === 'deslogado') return <Entrar />
  if (estado === 'primeiro_acesso') return <PrimeiroAcesso />
  return (
    <div className="app">
      <Menu />
      <div className="conteudo">
        <BarraSuperior />
        {aviso && <p className="faixa-aviso" role="status">{aviso}</p>}
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
          {/* Páginas abertas, sem o menu: formulário do QR e convite de equipe */}
          <Route path="/q/:slug" element={<FormularioPublico />} />
          <Route path="/convite/:token" element={<Convite />} />
          <Route element={<Painel />}>
            <Route index element={<Inicio />} />
            <Route path="kanban" element={<Kanban />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="configuracoes" element={<Equipe />} />
            <Route path="*" element={<EmConstrucao />} />
          </Route>
        </Routes>
      </ProvedorSessao>
    </BrowserRouter>
  )
}
