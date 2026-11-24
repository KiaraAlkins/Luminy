import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Botao, Cartao, Chip } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'

const CORES = ['#E5484D', '#3D2EF9', '#2E90FA', '#12A15F', '#E8890C', '#D6297A', '#17142E']

/** Clientes da agência. Só o proprietário cria; cada cliente já nasce com o Kanban de redes sociais. */
export function Clientes() {
  const { agencia, clientes, ehProprietario, recarregar, trocarCliente } = useSessao()
  const navegar = useNavigate()
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState(CORES[0])
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function criar(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !agencia || !nome.trim()) return
    setEnviando(true); setErro(null)
    const { data, error } = await supabase.rpc('criar_cliente', { p_agencia: agencia.id, p_nome: nome.trim(), p_cor: cor })
    setEnviando(false)
    if (error) { setErro(/duplicate|unique/i.test(error.message) ? 'Já existe um cliente com este nome.' : 'Não foi possível criar o cliente.'); return }
    setNome('')
    await recarregar()
    trocarCliente(data as string)
    navegar('/kanban')
  }

  return (
    <div className="corpo">
      <div><h2>Clientes</h2><p className="pequeno">{agencia?.nome}</p></div>
      {ehProprietario && (
        <Cartao titulo="Novo cliente">
          <form onSubmit={criar} className="linha" style={{ alignItems: 'flex-end', gap: 12 }}>
            <div className="campo" style={{ flex: 1, minWidth: 220 }}>
              <label htmlFor="nome-cliente">Nome do cliente</label>
              <input id="nome-cliente" className="entrada" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Hospital Santa Marta" required />
            </div>
            <div className="campo">
              <span className="pequeno" style={{ color: 'var(--texto-2)' }}>Cor</span>
              <div className="linha">{CORES.map((c) => (
                <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={cor === c} onClick={() => setCor(c)}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: cor === c ? '3px solid var(--marca-suave)' : '0', outline: cor === c ? '2px solid var(--marca)' : 'none', cursor: 'pointer' }} />
              ))}</div>
            </div>
            <Botao type="submit" icone={<Plus size={16} />} disabled={enviando}>{enviando ? 'Criando…' : 'Criar cliente'}</Botao>
          </form>
          {erro && <p className="pequeno" style={{ color: 'var(--perigo)' }}>{erro}</p>}
          <p className="pequeno">O cliente já nasce com o Kanban de redes sociais. Depois, convide a equipe em Configurações.</p>
        </Cartao>
      )}
      <div className="grade-clientes">
        {clientes.map((c) => (
          <button key={c.id} type="button" className="cartao cartao-cliente" onClick={() => { trocarCliente(c.id); navegar('/kanban') }}>
            <Avatar nome={c.nome} cor={c.cor} tamanho={48} />
            <strong>{c.nome}</strong>
            <Chip tom={c.papel === 'proprietario' ? 'marca' : 'neutro'}>{c.papel === 'proprietario' ? 'Seu cliente' : c.papel === 'admin' ? 'Administrador' : 'Membro'}</Chip>
          </button>
        ))}
        {clientes.length === 0 && <p className="texto-2">Nenhum cliente ainda.</p>}
      </div>
    </div>
  )
}
