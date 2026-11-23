import { Bell, Plus, Search } from 'lucide-react'
import { Botao } from './ui'
import { useSessao } from '../lib/sessao'

export function BarraSuperior() {
  const { cliente } = useSessao()
  return (
    <header className="barra">
      <div className="busca" role="search">
        <Search size={18} aria-hidden />
        <span>Buscar em {cliente.nome}…</span>
        <kbd className="tecla">Ctrl K</kbd>
      </div>
      <div className="barra__acoes">
        <button className="icone-botao" type="button" aria-label="Notificações">
          <Bell size={18} aria-hidden />
          <span className="ponto" />
        </button>
        <Botao icone={<Plus size={16} aria-hidden />}>Criar</Botao>
      </div>
    </header>
  )
}
