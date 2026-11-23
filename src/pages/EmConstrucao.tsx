import { useLocation } from 'react-router-dom'
import { Cartao } from '../components/ui'

const NOMES: Record<string, string> = {
  '/tarefas': 'Minhas tarefas', '/calendario': 'Calendário', '/demandas': 'Demandas', '/kanban': 'Kanban redes sociais',
  '/aprovacoes': 'Aprovações', '/agendamento': 'Agendamento', '/campanhas': 'Campanhas QR', '/leads': 'Leads',
  '/pauta': 'Acervo de Pauta', '/clientes': 'Clientes', '/comercial': 'Comercial', '/financeiro': 'Financeiro',
  '/relatorios': 'Relatórios', '/configuracoes': 'Configurações',
}

export function EmConstrucao() {
  const { pathname } = useLocation()
  return (
    <div className="corpo">
      <h2>{NOMES[pathname] ?? 'Página'}</h2>
      <Cartao><p className="texto-2">Esta tela já está desenhada no Figma e entra nas próximas etapas da Fase 1.</p></Cartao>
    </div>
  )
}
