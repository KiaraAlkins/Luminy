import { useState } from 'react'
import { Link as RouterLink, NavLink, useLocation } from 'react-router-dom'
import {
  BadgeCheck, Boxes, Briefcase, Building2, CalendarDays, CalendarRange, ChevronDown, ClipboardList, Columns3, FileSignature, Handshake, HeartPulse, Home, Inbox,
  LayoutGrid, Lightbulb, ListChecks, LogOut, Package, Palette, PanelLeftClose, PanelLeftOpen, QrCode, Repeat, Send,
  SlidersHorizontal, Ticket, Users, Wallet, Waypoints,
} from 'lucide-react'
import logo from '../assets/luminy-logo.svg'
import { Avatar } from './ui'
import { useSessao } from '../lib/sessao'

type Item = { para: string; rotulo: string; icone: React.ElementType; fim?: boolean; ativoEm?: RegExp; somenteLeads?: boolean }
type Guia = { id: string; rotulo: string; icone: React.ElementType; itens: Item[]; somenteAdmin?: boolean }

const MEU_ESPACO: Item[] = [
  { para: '/', rotulo: 'Início', icone: Home, fim: true },
  { para: '/tarefas', rotulo: 'Minhas tarefas', icone: ListChecks },
  { para: '/calendario', rotulo: 'Calendário', icone: CalendarDays },
]

/** Guias do cliente: cada uma abre e fecha no menu lateral. */
const GUIAS: Guia[] = [
  {
    id: 'design', rotulo: 'Design', icone: Palette, itens: [
      { para: '/kanban', rotulo: 'Kanban redes sociais', icone: Columns3 },
      { para: '/aprovacoes', rotulo: 'Aprovações', icone: BadgeCheck },
      { para: '/agendamento', rotulo: 'Agendamento', icone: Send },
      { para: '/pauta', rotulo: 'Acervo de Pauta', icone: Lightbulb },
    ],
  },
  {
    id: 'eventos', rotulo: 'Eventos', icone: Ticket, itens: [
      { para: '/eventos', rotulo: 'Empresas', icone: Building2, fim: true, ativoEm: /^\/eventos(\/empresas\/.*)?$/ },
      { para: '/eventos/parcerias', rotulo: 'Parcerias', icone: Waypoints },
      { para: '/eventos/agenda', rotulo: 'Agenda de eventos', icone: CalendarRange },
      { para: '/demandas', rotulo: 'Demandas', icone: Inbox },
      { para: '/eventos/planos', rotulo: 'Planos de saúde', icone: HeartPulse },
      { para: '/eventos/campanhas', rotulo: 'Campanhas QR', icone: QrCode, somenteLeads: true },
      { para: '/eventos/leads', rotulo: 'Leads', icone: Users, somenteLeads: true },
    ],
  },
  {
    id: 'negocios', rotulo: 'Negócios', icone: Briefcase, somenteAdmin: true, itens: [
      { para: '/comercial', rotulo: 'Comercial', icone: Handshake },
      { para: '/financeiro', rotulo: 'Financeiro', icone: Wallet },
      { para: '/contratos', rotulo: 'Contratos e notas', icone: FileSignature },
    ],
  },
  {
    id: 'organizacao', rotulo: 'Organização', icone: Boxes, itens: [
      { para: '/rotinas', rotulo: 'Rotinas', icone: Repeat },
      { para: '/ordens', rotulo: 'Ordens de serviço', icone: ClipboardList },
      { para: '/estoque', rotulo: 'Estoque', icone: Package },
    ],
  },
]

const CHAVE_GUIAS = 'luminy.menu.guias'
function lerGuias(): Record<string, boolean> { try { return JSON.parse(localStorage.getItem(CHAVE_GUIAS) ?? '{}') as Record<string, boolean> } catch { return {} } }

const estaAtivo = (i: Item, caminho: string) => (i.ativoEm ? i.ativoEm.test(caminho) : i.fim ? caminho === i.para : caminho === i.para || caminho.startsWith(`${i.para}/`))

function Link({ item, sub = false }: { item: Item; sub?: boolean }) {
  const { pathname } = useLocation()
  const Icone = item.icone
  return (
    <NavLink to={item.para} end={item.fim} title={item.rotulo}
      className={() => `menu__item${sub ? ' menu__item--sub' : ''}${estaAtivo(item, pathname) ? ' ativo' : ''}`}>
      <Icone size={sub ? 16 : 18} strokeWidth={1.8} aria-hidden />
      <span className="menu__texto">{item.rotulo}</span>
    </NavLink>
  )
}

function GuiaMenu({ guia, itens, aberta, onAlternar }: { guia: Guia; itens: Item[]; aberta: boolean; onAlternar: () => void }) {
  const { pathname } = useLocation()
  const Icone = guia.icone
  const temAtivo = itens.some((i) => estaAtivo(i, pathname))
  return (
    <div className={`guia${aberta ? ' guia--aberta' : ''}${temAtivo ? ' guia--ativa' : ''}`}>
      <button type="button" className="guia__topo" aria-expanded={aberta} onClick={onAlternar} title={guia.rotulo}>
        <Icone size={18} strokeWidth={1.8} aria-hidden />
        <span className="menu__texto">{guia.rotulo}</span>
        <ChevronDown size={15} className="guia__seta" aria-hidden />
      </button>
      <div className="guia__corpo">
        <div className="guia__itens">{itens.map((i) => <Link key={i.para} item={i} sub />)}</div>
      </div>
      {/* Menu recolhido: as páginas da guia aparecem ao passar o mouse */}
      <div className="guia__flutuante" role="menu" aria-label={guia.rotulo}>
        <span className="rotulo">{guia.rotulo}</span>
        {itens.map((i) => <Link key={i.para} item={i} sub />)}
      </div>
    </div>
  )
}

export function Menu({ recolhido, alternar }: { recolhido: boolean; alternar: () => void }) {
  const { usuario, cliente, clientes, trocarCliente, ehProprietario, ehAdminCliente, acessoLeads, sair } = useSessao()
  const { pathname } = useLocation()
  const [aberto, setAberto] = useState(false)
  const [guias, setGuias] = useState<Record<string, boolean>>(lerGuias)

  const visiveis = GUIAS.filter((g) => !g.somenteAdmin || ehAdminCliente)
    .map((g) => ({ guia: g, itens: g.itens.filter((i) => !i.somenteLeads || acessoLeads) }))
    .filter((g) => g.itens.length > 0)
  // A guia da página atual fica sempre aberta; as outras lembram a escolha da pessoa
  const estaAberta = (g: Guia, itens: Item[]) => itens.some((i) => estaAtivo(i, pathname)) || (guias[g.id] ?? false)
  function alternarGuia(g: Guia, itens: Item[]) {
    const n = { ...guias, [g.id]: !estaAberta(g, itens) }
    setGuias(n)
    try { localStorage.setItem(CHAVE_GUIAS, JSON.stringify(n)) } catch { /* sem armazenamento */ }
  }

  return (
    <nav className="menu" aria-label="Navegação principal">
      <div className="menu__logo">
        <RouterLink to="/principal" title="Página principal: todos os clientes"><img src={logo} alt="Luminy, página principal" /></RouterLink>
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
              <li><RouterLink to="/principal" className="seletor__novo" onClick={() => setAberto(false)}><LayoutGrid size={16} /> Página principal</RouterLink></li>
              <li className="seletor__divisor" aria-hidden />
              {clientes.map((c) => (
                <li key={c.id}>
                  <button type="button" role="option" aria-selected={c.id === cliente.id}
                    onClick={() => { trocarCliente(c.id); setAberto(false) }}>
                    <Avatar nome={c.nome} cor={c.cor} tamanho={24} /> {c.nome}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <RouterLink to="/principal" className="seletor-cliente seletor-cliente--vazio">
          <LayoutGrid size={18} aria-hidden />
          <span className="seletor-cliente__texto"><span className="forte">{ehProprietario ? 'Adicionar cliente' : 'Escolher cliente'}</span></span>
        </RouterLink>
      )}

      <div className="menu__grupo rotulo">Meu espaço</div>
      {MEU_ESPACO.map((i) => <Link key={i.para} item={i} />)}

      {cliente && (
        <>
          <div className="menu__grupo rotulo">{cliente.nome}</div>
          {visiveis.map(({ guia, itens }) => (
            <GuiaMenu key={guia.id} guia={guia} itens={itens} aberta={!recolhido && estaAberta(guia, itens)} onAlternar={() => alternarGuia(guia, itens)} />
          ))}
        </>
      )}

      <div className="menu__espaco" />
      <Link item={{ para: '/configuracoes', rotulo: 'Configurações', icone: SlidersHorizontal }} />
      <div className="menu__usuario">
        {usuario.foto_url ? <img className="foto-usuario" src={usuario.foto_url} alt="" /> : <Avatar nome={usuario.nome || '?'} cor="var(--marca)" />}
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
