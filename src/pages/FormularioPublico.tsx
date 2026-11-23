import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './formulario.css'

type Campo = { chave: string; rotulo: string; tipo: string; modo: 'obrigatorio' | 'exibir'; opcoes?: string[] }
type Formulario =
  | { situacao: 'ativa'; cliente: string; cor: string; titulo: string; texto?: string; campos: Campo[] }
  | { situacao: 'encerrada' | 'inexistente'; cliente?: string }

// Usado quando o Supabase ainda não está conectado, para revisar a tela.
const DEMO: Formulario = {
  situacao: 'ativa', cliente: 'Hospital Santa Marta', cor: '#3D2EF9', titulo: 'Dia do Homem 2026',
  texto: 'Garanta seu check-up com condições especiais.',
  campos: [
    { chave: 'nome', rotulo: 'Nome completo', tipo: 'texto', modo: 'obrigatorio' },
    { chave: 'whatsapp', rotulo: 'WhatsApp', tipo: 'telefone', modo: 'obrigatorio' },
    { chave: 'email', rotulo: 'E-mail', tipo: 'email', modo: 'exibir' },
    { chave: 'interesse', rotulo: 'Interesse', tipo: 'escolha', modo: 'exibir', opcoes: ['Check-up masculino', 'Urologia', 'Cardiologia'] },
    { chave: 'diabetes', rotulo: 'Tem diabetes ou histórico na família?', tipo: 'sim_nao', modo: 'exibir' },
  ],
}

const TIPO_INPUT: Record<string, string> = { telefone: 'tel', email: 'email', texto: 'text', data: 'date' }

export function FormularioPublico() {
  const { slug = '' } = useParams()
  const [form, setForm] = useState<Formulario | null>(supabase ? null : DEMO)
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [aceiteContato, setAceiteContato] = useState(false)
  const [aceiteCampanhas, setAceiteCampanhas] = useState(false)
  const [estado, setEstado] = useState<'preenchendo' | 'enviando' | 'enviado'>('preenchendo')
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.rpc('formulario_publico', { p_slug: slug }).then(({ data, error }) => {
      setForm(error ? { situacao: 'inexistente' } : (data as Formulario))
    })
  }, [slug])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEstado('enviando')
    if (supabase) {
      const { error } = await supabase.rpc('enviar_lead', {
        p_slug: slug, p_respostas: respostas, p_aceite_contato: aceiteContato, p_aceite_campanhas: aceiteCampanhas,
      })
      if (error) { setErro('Não foi possível enviar. Confira os campos e tente de novo.'); setEstado('preenchendo'); return }
    }
    setEstado('enviado')
  }

  if (!form) return <main className="publico"><div className="publico__cartao"><p className="pequeno">Carregando…</p></div></main>

  if (form.situacao !== 'ativa') {
    return (
      <main className="publico"><div className="publico__cartao publico__corpo">
        <h3>{form.situacao === 'encerrada' ? 'Esta campanha foi encerrada' : 'Link não encontrado'}</h3>
        <p className="texto-2">{form.cliente ? `Obrigado pelo interesse no ${form.cliente}.` : 'Confira o endereço e tente novamente.'}</p>
      </div></main>
    )
  }

  return (
    <main className="publico">
      <div className="publico__cartao">
        <header className="publico__capa" style={{ background: form.cor }}>
          <span className="rotulo" style={{ color: '#fff' }}>{form.cliente}</span>
          <h2>{form.titulo}</h2>
          {form.texto && <p>{form.texto}</p>}
        </header>

        {estado === 'enviado' ? (
          <div className="publico__corpo">
            <h3>Recebemos seus dados!</h3>
            <p className="texto-2">Nossa equipe vai falar com você pelo WhatsApp em até 1 dia útil.</p>
          </div>
        ) : (
          <form className="publico__corpo" onSubmit={enviar}>
            {form.campos.map((c) => (
              <div className="campo" key={c.chave}>
                <label htmlFor={c.chave}>{c.rotulo}{c.modo === 'obrigatorio' ? ' *' : ''}</label>
                {c.tipo === 'escolha' || c.tipo === 'sim_nao' ? (
                  <div className="opcoes" role="radiogroup" aria-labelledby={c.chave}>
                    {(c.tipo === 'sim_nao' ? ['Sim', 'Não'] : c.opcoes ?? []).map((o) => (
                      <button type="button" key={o} role="radio" aria-checked={respostas[c.chave] === o}
                        className={`opcao${respostas[c.chave] === o ? ' marcada' : ''}`}
                        onClick={() => setRespostas({ ...respostas, [c.chave]: o })}>{o}</button>
                    ))}
                  </div>
                ) : (
                  <input id={c.chave} className="entrada" type={TIPO_INPUT[c.tipo] ?? 'text'} required={c.modo === 'obrigatorio'}
                    autoComplete={c.chave === 'nome' ? 'name' : c.chave === 'email' ? 'email' : c.chave === 'whatsapp' ? 'tel' : undefined}
                    value={respostas[c.chave] ?? ''} onChange={(e) => setRespostas({ ...respostas, [c.chave]: e.target.value })} />
                )}
              </div>
            ))}

            <label className="aceite">
              <input type="checkbox" checked={aceiteContato} onChange={(e) => setAceiteContato(e.target.checked)} required />
              <span>Autorizo o {form.cliente} a usar meus dados para entrar em contato sobre esta solicitação, conforme a <a href="#politica">política de privacidade</a>.</span>
            </label>
            <label className="aceite">
              <input type="checkbox" checked={aceiteCampanhas} onChange={(e) => setAceiteCampanhas(e.target.checked)} />
              <span>Quero receber campanhas e convites de saúde do {form.cliente}. Posso sair quando quiser. (opcional)</span>
            </label>

            {erro && <p className="publico__erro" role="alert">{erro}</p>}
            <button className="botao botao--primario" type="submit" disabled={!aceiteContato || estado === 'enviando'} style={{ background: form.cor }}>
              {estado === 'enviando' ? 'Enviando…' : 'Enviar'}
            </button>
          </form>
        )}
      </div>
      <p className="pequeno publico__rodape">Formulário seguro · Luminy</p>
    </main>
  )
}
