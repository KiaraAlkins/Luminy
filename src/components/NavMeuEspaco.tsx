import { NavLink } from 'react-router-dom'
import { CalendarDays, Columns3, ListChecks, Repeat } from 'lucide-react'

/** Abas do Meu espaço: as mesmas tarefas pessoais vistas em lista, em Kanban, no calendário e na rotina. */
export function NavMeuEspaco() {
  const abas = [
    { para: '/tarefas', rotulo: 'Tarefas', icone: ListChecks },
    { para: '/meu-kanban', rotulo: 'Kanban', icone: Columns3 },
    { para: '/calendario', rotulo: 'Calendário', icone: CalendarDays },
    { para: '/minha-rotina', rotulo: 'Rotina', icone: Repeat },
  ]
  return (
    <nav className="nav-meu-espaco" aria-label="Meu espaço">
      {abas.map(({ para, rotulo, icone: I }) => (
        <NavLink key={para} to={para} className={({ isActive }) => `nav-meu-espaco__aba${isActive ? ' ativa' : ''}`}><I size={15} /> {rotulo}</NavLink>
      ))}
    </nav>
  )
}
