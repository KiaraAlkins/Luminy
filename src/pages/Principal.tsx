import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, LogOut, Plus, Sparkles } from 'lucide-react'
import logo from '../assets/luminy-logo.svg'
import { Avatar, Botao, Chip } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import './principal.css'

const CORES = ['#E5484D', '#3D2EF9', '#2E90FA', '#12A15F', '#E8890C', '#D6297A', '#17142E']

function saudacao() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

/**
 * Página principal, fora de qualquer cliente: todos os clientes num lugar só.
 * O site abre direto no último cliente usado; esta página fica a um clique (logo ou seletor de cliente).
 */
export function Principal() {
  const { usuario, agencia, cliente: ultimo, clientes, ehProprietario, recarregar, trocarCliente, sair } = useSessao()
  const navegar = useNavigate()
  const [criando, setCriando] = useState(false)
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState(CORES[0])
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  function entrar(id: string) { trocarCliente(id); navegar('/') }

  async function criar(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    if (!supabase || !agencia) { setErro('No modo demonstração não dá para criar clientes.'); return }
    setEnviando(true); setErro(null)
    const { data, error } = await supabase.rpc('criar_cliente', { p_agencia: agencia.id, p_nome: nome.trim(), p_cor: cor })
    setEnviando(false)
    if (error) { setErro(/duplicate|unique/i.test(error.message) ? 'Já existe um cliente com este nome.' : 'Não foi possível criar o cliente.'); return }
    await recarregar()
    entrar(data as string)
  }

  const primeiroNome = usuario.nome.split(' ')[0]
  return (
    <div className="principal">
      <header className="principal__topo">
        <img src={logo} alt="Luminy" className="principal__logo" />
        <span className="principal__agencia">{agencia?.nome ?? 'Página principal'}</span>
        <span style={{ flex: 1 }} />
        <span className="linha" style={{ gap: 10 }}><Avatar nome={usuario.nome || '?'} cor="var(--marca)" /><strong>{usuario.nome}</strong></span>
        <button type="button" className="icone-botao" aria-label="Sair" title="Sair" onClick={() => void sair()}><LogOut size={16} /></button>
      </header>

      <main className="principal__corpo pagina-entra">
        <div>
          <h1>{saudacao()}{primeiroNome ? `, ${primeiroNome}` : ''}!</h1>
          <p className="texto-2">{clientes.length ? 'Escolha um cliente para entrar.' : 'Você ainda não tem clientes.'} O Luminy sempre abre no último cliente que você usou.</p>
        </div>

        <section className="grade-principal">
          {clientes.map((c, i) => (
            <button key={c.id} type="button" className="cliente-cartao" style={{ '--cor': c.cor, animationDelay: `${i * 50}ms` } as React.CSSProperties} onClick={() => entrar(c.id)}>
              <span className="cliente-cartao__faixa" aria-hidden />
              <Avatar nome={c.nome} cor={c.cor} tamanho={52} />
              <strong className="cliente-cartao__nome">{c.nome}</strong>
              <span className="linha" style={{ gap: 6 }}>
                <Chip tom={c.papel === 'proprietario' ? 'marca' : 'neutro'}>{c.papel === 'proprietario' ? 'Seu cliente' : c.papel === 'admin' ? 'Administrador' : 'Equipe'}</Chip>
                {ultimo?.id === c.id && <Chip tom="sucesso">Último aberto</Chip>}
              </span>
              <span className="cliente-cartao__entrar">Entrar <ArrowRight size={16} /></span>
            </button>
          ))}

          {ehProprietario && !criando && (
            <button type="button" className="cliente-cartao cliente-cartao--novo" onClick={() => setCriando(true)}>
              <span className="cliente-cartao__mais"><Plus size={26} /></span>
              <strong>Novo cliente</strong>
              <span className="pequeno">Já nasce com o Kanban de redes sociais</span>
            </button>
          )}

          {criando && (
            <form className="cliente-cartao cliente-cartao--form" onSubmit={criar}>
              <strong>Novo cliente</strong>
              <input className="entrada" autoFocus required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Clínica Bem Viver" aria-label="Nome do cliente" />
              <div className="linha" role="radiogroup" aria-label="Cor do cliente">{CORES.map((c) => (
                <button key={c} type="button" role="radio" aria-label={`Cor ${c}`} aria-checked={cor === c} className={`cor${cor === c ? ' marcada' : ''}`} style={{ background: c }} onClick={() => setCor(c)} />
              ))}</div>
              {erro && <p className="pequeno" style={{ color: 'var(--perigo)' }}>{erro}</p>}
              <div className="linha">
                <Botao type="button" variante="fantasma" onClick={() => { setCriando(false); setErro(null) }}>Cancelar</Botao>
                <Botao type="submit" disabled={enviando}>{enviando ? 'Criando…' : 'Criar e entrar'}</Botao>
              </div>
            </form>
          )}
        </section>

        {!ehProprietario && clientes.length === 0 && (
          <p className="faixa-aviso"><Sparkles size={15} /> Peça para quem administra a equipe te mandar um convite.</p>
        )}
      </main>
    </div>
  )
}
