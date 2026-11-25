import { useState } from 'react'
import { Link as RouterLink, NavLink } from 'react-router-dom'
import {
  BadgeCheck, Briefcase, CalendarDays, ChartLine, ChevronDown, Columns3, Handshake, Home, Inbox, Lightbulb,
  Building2, ListChecks, Package, LogOut, PanelLeftClose, PanelLeftOpen, Plus, Send, SlidersHorizontal, Wallet,
} from 'lucide-react'
import logo from '../assets/luminy-logo.svg'
import { Avatar } from './ui'
import { useSessao } from '../lib/sessao'

type Item = { para: string; rotulo: string; icone: React.ElementType; somenteLeads?: boolean }

const MEU_ESPACO: Item[] = [
  { para: '/', rotulo: 'Início', icone: Home },
  { para: '/tarefas', rotulo: 'Minhas tarefas', icone: ListChecks },
  { para: '/calendario', rotulo: 'Calendário', icone: CalendarDays },
]
const CLIENTE: Item[] = [
  { para: '/demandas', rotulo: 'Demandas', icone: Inbox },
  { para: '/kanban', rotulo: 'Kanban redes sociais', icone: Columns3 },
  { para: '/aprovacoes', rotulo: 'Aprovações', icone: BadgeCheck },
  { para: '/agendamento', rotulo: 'Agendamento', icone: Send },
  { para: '/eventos', rotulo: 'Eventos e parcerias', icone: Building2 },
  { para: '/estoque', rotulo: 'Estoque', icone: Package },
  { para: '/pauta', rotulo: 'Acervo de Pauta', icone: Lightbulb },
]
const AGENCIA: Item[] = [
  { para: '/clientes', rotulo: 'Clientes', icone: Briefcase },
  { para: '/comercial', rotulo: 'Comercial', icone: Handshake },
  { para: '/financeiro', rotulo: 'Financeiro', icone: Wallet },
  { para: '/relatorios', rotulo: 'Relatórios', icone: ChartLine },
]

function Link({ item }: { item: Item }) {
  const Icone = item.icone
  return (
    <NavLink to={item.para} end={item.para === '/'} title={item.rotulo} className={({ isActive }) => `menu__item${isActive ? ' ativo' : ''}`}>
      <Icone size={18} strokeWidth={1.8} aria-hidden />
      <span className="menu__texto">{item.rotulo}</span>
    </NavLink>
  )
}

export function Menu({ recolhido, alternar }: { recolhido: boolean; alternar: () => void }) {
  const { usuario, agencia, cliente, clientes, trocarCliente, ehProprietario, acessoLeads, sair } = useSessao()
  const [aberto, setAberto] = useState(false)
  return (
    <nav className="menu" aria-label="Navegação principal">
      <div className="menu__logo">
        <img src={logo} alt="Luminy" />
        <button type="button" className="menu__recolher" onClick={alternar}
          aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'} title={recolhido ? 'Expandir menu' : 'Recolher menu'} aria-pressed={recolhido}>
          {recolhido ? <PanelLeftOpen size={18} aria-hidden /> : <PanelLeftClose size={18} aria-hidden />}
        </button>
      </div>

      {cliente ? (
        <div className="seletor">
          <button className="seletor-cliente" type="button" title={cliente.nome} aria-expanded={aberto} aria-haspopup="listbox" onClick={() => setAberto(!aberto)}>
            <Avatar nome={cliente.nome} cor={cliente.cor} />
            <span className="seletor-cliente__texto">
              <span className="pequeno" style={{ display: 'block' }}>Cliente</span>
              <span className="forte">{cliente.nome}</span>
            </span>
            <ChevronDown size={16} aria-hidden />
          </button>
          {aberto && (
            <ul className="seletor__lista" role="listbox" aria-label="Trocar de cliente">
              {clientes.map((c) => (
                <li key={c.id}>
                  <button type="button" role="option" aria-selected={c.id === cliente.id}
                    onClick={() => { trocarCliente(c.id); setAberto(false) }}>
                    <Avatar nome={c.nome} cor={c.cor} tamanho={24} /> {c.nome}
                  </button>
                </li>
              ))}
              {ehProprietario && (
                <li><RouterLink to="/clientes" className="seletor__novo" onClick={() => setAberto(false)}><Plus size={16} /> Novo cliente</RouterLink></li>
              )}
            </ul>
          )}
        </div>
      ) : (
        <RouterLink to="/clientes" className="seletor-cliente seletor-cliente--vazio">
          <Plus size={18} aria-hidden />
          <span className="seletor-cliente__texto"><span className="forte">Adicionar cliente</span></span>
        </RouterLink>
      )}

      <div className="menu__grupo rotulo">Meu espaço</div>
      {MEU_ESPACO.map((i) => <Link key={i.para} item={i} />)}

      {cliente && (
        <>
          <div className="menu__grupo rotulo">{cliente.nome}</div>
          {CLIENTE.filter((i) => !i.somenteLeads || acessoLeads).map((i) => <Link key={i.para} item={i} />)}
        </>
      )}

      {ehProprietario && (
        <>
          <div className="menu__grupo"><span className="rotulo">{agencia?.nome ?? 'Agência'}</span><span className="menu__selo">privado</span></div>
          {AGENCIA.map((i) => <Link key={i.para} item={i} />)}
        </>
      )}

      <div className="menu__espaco" />
      <Link item={{ para: '/configuracoes', rotulo: 'Configurações', icone: SlidersHorizontal }} />
      <div className="menu__usuario">
        <Avatar nome={usuario.nome || '?'} cor="var(--marca)" />
        <div className="menu__texto" style={{ flex: 1, minWidth: 0 }}>
          <div className="forte">{usuario.nome}</div>
          <div className="pequeno">{cliente?.papel === 'proprietario' ? 'Proprietário' : cliente?.papel === 'admin' ? 'Administrador' : 'Equipe'}</div>
        </div>
        <button className="icone-botao" style={{ width: 32, height: 32, border: 0 }} type="button" aria-label="Sair" title="Sair" onClick={() => void sair()}>
          <LogOut size={16} aria-hidden />
        </button>
      </div>
    </nav>
  )
}
