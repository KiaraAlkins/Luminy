import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Check, Clock, Sparkles } from 'lucide-react'
import { Avatar, Botao, Cartao, Chip } from '../components/ui'
import { useSessao } from '../lib/sessao'
import './inicio.css'

// Dados de demonstração. Ao conectar o Supabase, vêm das tabelas tarefas, demandas, cards e leads.
const AGENDA = [
  { hora: '09:30', titulo: 'Reunião de pauta da semana', onde: 'Equipe de marketing' },
  { hora: '11:00', titulo: 'Gravação com o cardiologista', onde: 'Hospital · 2º andar' },
  { hora: '14:00', titulo: 'Aprovação com a diretoria', onde: 'Portal do cliente' },
  { hora: '16:00', titulo: 'Publicar Novembro Azul', onde: 'Instagram e Facebook', destaque: true },
]
const DEMANDAS = [
  { titulo: 'Arte para a campanha de vacinação', de: 'Pedro', prazo: '26/11' },
  { titulo: 'Vídeo institucional da UTI', de: 'Kiara', prazo: '02/12' },
]
const ORIGENS = [
  { nome: 'Dia do Homem 2026 · Cartaz', total: 7 },
  { nome: 'Dia do Homem 2026 · Stories', total: 3 },
  { nome: 'Empresa X · Convênio', total: 2 },
]
const PUBLICACOES = [
  { dia: 'Hoje', hora: '18:00', titulo: 'Carrossel Novembro Azul', redes: ['Instagram', 'Facebook'] },
  { dia: 'Ter', hora: '10:00', titulo: 'Reels Dia do Homem', redes: ['Instagram', 'TikTok'] },
  { dia: 'Qui', hora: '12:00', titulo: 'Doação de sangue', redes: ['Instagram'] },
]
const SEMANA = [['Seg', 2], ['Ter', 3], ['Qua', 2], ['Qui', 0], ['Sex', 4], ['Sáb', 1], ['Dom', 3]] as const

function saudacao(d: Date) {
  const h = d.getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export function Inicio() {
  const { usuario, acessoLeads, cliente, ehProprietario, agencia } = useSessao()
  const [hoje] = useState(() => new Date())
  const dataLonga = hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const totalLeads = ORIGENS.reduce((s, o) => s + o.total, 0)
  const diaSemana = (hoje.getDay() + 6) % 7

  if (!cliente) {
    return (
      <div className="corpo">
        <div className="saudacao"><div>
          <div className="rotulo">{dataLonga}</div>
          <h1>{saudacao(hoje)}, {usuario.nome.split(' ')[0]}</h1>
          <p className="texto-2">{agencia ? `Sua agência ${agencia.nome} está pronta.` : 'Sua conta está pronta.'}</p>
        </div></div>
        <Cartao titulo="Primeiros passos">
          <ol className="passos">
            <li className="feito"><strong>Criar a conta</strong><span className="pequeno">Feito</span></li>
            {ehProprietario ? (
              <>
                <li><strong>Cadastrar o primeiro cliente</strong><span className="pequeno">Cada cliente tem Kanban, calendário, campanhas e equipe próprios.</span>
                  <Link className="botao botao--primario" to="/principal">Cadastrar cliente</Link></li>
                <li><strong>Convidar a equipe</strong><span className="pequeno">Por link no WhatsApp ou por e-mail, em Configurações.</span></li>
                <li><strong>Criar a primeira campanha com QR Code</strong><span className="pequeno">Para captar leads em eventos.</span></li>
              </>
            ) : (
              <li><strong>Entrar numa equipe</strong><span className="pequeno">Peça o link do convite ao administrador da equipe.</span></li>
            )}
          </ol>
        </Cartao>
      </div>
    )
  }

  return (
    <div className="corpo">
      <div className="saudacao">
        <div>
          <div className="rotulo">{dataLonga}</div>
          <h1>{saudacao(hoje)}, {usuario.nome.split(' ')[0]}</h1>
          <p className="texto-2">
            Hoje você tem 3 entregas, 2 demandas esperando resposta
            {acessoLeads ? ` e ${totalLeads} leads novos para atender.` : '.'}
          </p>
        </div>
        <Botao variante="secundario">Personalizar painel</Botao>
      </div>

      <div className="bento">
        <section className="cartao bento--2 tarefa-atual">
          <header className="cartao__topo">
            <h4 className="rotulo" style={{ color: '#fff' }}>Tarefa atual</h4>
            <span className="pequeno" style={{ color: '#fff' }}>3 de 5 itens do checklist</span>
          </header>
          <h2>Finalizar carrossel Novembro Azul</h2>
          <div className="linha">
            <Clock size={16} aria-hidden /> <span className="pequeno" style={{ color: '#fff' }}>Entrega hoje, 16:00</span>
            <Chip tom="vidro">Instagram</Chip><Chip tom="vidro">Facebook</Chip><Chip tom="vidro">Carrossel</Chip>
          </div>
          <div className="progresso"><span style={{ width: '60%' }} /></div>
          <div className="linha">
            <button className="botao botao-claro" type="button"><Check size={16} aria-hidden /> Concluir</button>
            <button className="botao botao-contorno" type="button">Abrir card</button>
            <button className="botao botao-transparente" type="button"><AlertTriangle size={16} aria-hidden /> Registrar impedimento</button>
          </div>
        </section>

        <Cartao titulo="Agenda de hoje" acao={<a className="pequeno" href="/calendario">Ver calendário</a>}>
          {AGENDA.map((e) => (
            <div key={e.hora} className={`evento${e.destaque ? ' evento--destaque' : ''}`}>
              <span className="forte evento__hora">{e.hora}</span>
              <span className="evento__barra" />
              <div><div className="forte">{e.titulo}</div><div className="pequeno">{e.onde}</div></div>
            </div>
          ))}
        </Cartao>

        <Cartao titulo="Demandas recebidas" acao={<span className="pequeno" style={{ color: 'var(--marca)' }}>2 aguardando</span>}>
          {DEMANDAS.map((d) => (
            <div key={d.titulo} className="demanda">
              <div className="linha" style={{ alignItems: 'flex-start' }}>
                <Avatar nome={d.de} />
                <div><div className="forte">{d.titulo}</div><div className="pequeno">{d.de} · prazo {d.prazo}</div></div>
              </div>
              <div className="linha"><Botao>Aceitar</Botao><Botao variante="fantasma">Recusar</Botao></div>
            </div>
          ))}
        </Cartao>

        {acessoLeads && (
          <section className="cartao leads-novos">
            <header className="cartao__topo"><h4 className="rotulo" style={{ color: '#fff' }}>Leads novos</h4><span className="pequeno" style={{ color: 'var(--texto-sobre-escuro)' }}>Sigiloso</span></header>
            <div className="linha" style={{ alignItems: 'baseline' }}><span className="numero">{totalLeads}</span><span className="pequeno" style={{ color: 'var(--texto-sobre-escuro)' }}>desde ontem, 18h</span></div>
            {ORIGENS.map((o) => (
              <div key={o.nome} className="origem">
                <div className="linha"><span className="pequeno" style={{ color: '#fff', flex: 1 }}>{o.nome}</span><span className="forte">{o.total}</span></div>
                <div className="progresso progresso--escuro"><span style={{ width: `${(o.total / totalLeads) * 100}%` }} /></div>
              </div>
            ))}
            <a className="linha forte" style={{ color: '#fff' }} href="/leads">Abrir funil de leads <ArrowRight size={16} aria-hidden /></a>
          </section>
        )}

        <Cartao titulo="Próximas publicações" acao={<a className="pequeno" href="/agendamento">Calendário</a>}>
          {PUBLICACOES.map((p, i) => (
            <div key={p.titulo}>
              {i > 0 && <div className="divisor" style={{ marginBottom: 14 }} />}
              <div className="linha" style={{ alignItems: 'flex-start' }}>
                <div className={`dia${p.dia === 'Hoje' ? ' dia--hoje' : ''}`}><span>{p.dia}</span><strong>{p.hora}</strong></div>
                <div><div className="forte">{p.titulo}</div><div className="linha" style={{ marginTop: 6 }}>{p.redes.map((r) => <Chip key={r}>{r}</Chip>)}</div></div>
              </div>
            </div>
          ))}
        </Cartao>

        <Cartao titulo="Aguardando o cliente" acao={<span className="pequeno" style={{ color: 'var(--marca)' }}>3 posts</span>}>
          {[['Reels Dia do Homem', 'Enviado há 2 dias', false], ['Post Doação de sangue', 'Enviado ontem', false], ['Stories Outubro Rosa', 'Pediu ajuste no texto', true]].map(([t, s, alerta]) => (
            <div key={String(t)} className="linha">
              <span className="miniatura" />
              <div><div className="forte">{t}</div><div className="pequeno" style={alerta ? { color: 'var(--alerta)' } : undefined}>{s}</div></div>
            </div>
          ))}
        </Cartao>

        <Cartao titulo="Sua semana" className="bento--2" acao={<span className="pequeno" style={{ color: 'var(--marca)' }}>Resumo funcional</span>}>
          <div className="semana">
            {SEMANA.map(([d, n], i) => (
              <div key={d} className={`semana__dia${i === diaSemana ? ' hoje' : ''}`}>
                <span className="pequeno">{d}</span>
                <span className="semana__pontos">{Array.from({ length: Math.max(n, 1) }, (_, k) => <i key={k} className={n === 0 ? 'vazio' : ''} />)}</span>
              </div>
            ))}
          </div>
          <div className="sugestao"><Sparkles size={18} aria-hidden /> Quinta está livre de entregas. Que tal adiantar o roteiro do Dia do Médico?</div>
        </Cartao>
      </div>
    </div>
  )
}
