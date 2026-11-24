import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Copy, Link2, MessageCircle, Trash2 } from 'lucide-react'
import { Avatar, Botao, Cartao, Chip } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'

type Membro = { usuario_id: string; nome: string; papel: string; acesso_leads: boolean }
type Convite = { id: string; token: string; email: string | null; papel: string; acesso_leads: boolean; expira_em: string; aceito_em: string | null }

const linkDe = (token: string) => `${window.location.origin}/convite/${token}`

/** Configurações › Equipe: quem faz parte do cliente selecionado e convites por link ou e-mail. */
export function Equipe() {
  const { cliente, ehAdminCliente } = useSessao()
  const [membros, setMembros] = useState<Membro[]>([])
  const [convites, setConvites] = useState<Convite[]>([])
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState<'membro' | 'admin'>('membro')
  const [acessoLeads, setAcessoLeads] = useState(true)
  const [novo, setNovo] = useState<Convite | null>(null)
  const [copiado, setCopiado] = useState(false)

  const carregar = useCallback(async () => {
    if (!supabase || !cliente) return
    const [m, c] = await Promise.all([
      supabase.rpc('equipe_cliente', { p_cliente: cliente.id }),
      ehAdminCliente ? supabase.from('convites').select('*').eq('cliente_id', cliente.id).is('aceito_em', null).order('criado_em', { ascending: false }) : Promise.resolve({ data: [] }),
    ])
    setMembros((m.data ?? []) as Membro[])
    setConvites((c.data ?? []) as Convite[])
  }, [cliente, ehAdminCliente])

  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  async function convidar(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !cliente) return
    const { data, error } = await supabase.from('convites')
      .insert({ cliente_id: cliente.id, email: email.trim() || null, papel, acesso_leads: acessoLeads }).select().single()
    if (error) return
    setNovo(data as Convite); setEmail(''); setCopiado(false)
    await carregar()
  }

  async function cancelar(id: string) {
    await supabase?.from('convites').delete().eq('id', id)
    await carregar()
  }

  if (!cliente) return <div className="corpo"><h2>Equipe</h2><p className="texto-2">Crie um cliente primeiro para montar a equipe dele.</p></div>

  const mensagem = (c: Convite) => `Oi! Você foi convidado para a equipe do ${cliente.nome} no Luminy. Entre por este link: ${linkDe(c.token)}`

  return (
    <div className="corpo">
      <div><h2>Equipe</h2><p className="pequeno">{cliente.nome} · só quem é convidado entra na equipe deste cliente</p></div>

      {ehAdminCliente && (
        <Cartao titulo="Convidar pessoa">
          <form onSubmit={convidar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="linha" style={{ alignItems: 'flex-end', gap: 12 }}>
              <div className="campo" style={{ flex: 1, minWidth: 220 }}>
                <label htmlFor="email-convite">E-mail (opcional)</label>
                <input id="email-convite" className="entrada" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Deixe vazio para gerar um link de uso único" />
              </div>
              <div className="campo">
                <label htmlFor="papel">Papel</label>
                <select id="papel" className="entrada" value={papel} onChange={(e) => setPapel(e.target.value as 'membro' | 'admin')}>
                  <option value="membro">Membro</option><option value="admin">Administrador</option>
                </select>
              </div>
              <Botao type="submit" icone={<Link2 size={16} />}>Gerar convite</Botao>
            </div>
            <label className="aceite" style={{ fontSize: 13 }}>
              <input type="checkbox" checked={acessoLeads} onChange={(e) => setAcessoLeads(e.target.checked)} />
              <span><strong>Acesso a leads e campanhas QR.</strong> Desmarque para jovens aprendizes e para quem não atende leads.</span>
            </label>
          </form>
          {novo && (
            <div className="convite-gerado">
              <p className="forte">Convite criado{novo.email ? ` para ${novo.email}` : ''}. Válido por 7 dias.</p>
              <code>{linkDe(novo.token)}</code>
              <div className="linha">
                <Botao variante="secundario" icone={<Copy size={16} />} onClick={() => { void navigator.clipboard.writeText(linkDe(novo.token)); setCopiado(true) }}>{copiado ? 'Copiado!' : 'Copiar link'}</Botao>
                <a className="botao botao--secundario" href={`https://wa.me/?text=${encodeURIComponent(mensagem(novo))}`} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Enviar no WhatsApp</a>
              </div>
              {novo.email && <p className="pequeno">Se a pessoa criar a conta com este e-mail, ela entra na equipe sozinha, mesmo sem abrir o link.</p>}
            </div>
          )}
        </Cartao>
      )}

      <Cartao titulo={`Pessoas na equipe · ${membros.length}`}>
        {membros.map((m) => (
          <div key={m.usuario_id} className="linha" style={{ gap: 12 }}>
            <Avatar nome={m.nome || '?'} />
            <strong style={{ flex: 1 }}>{m.nome}</strong>
            {!m.acesso_leads && <Chip tom="neutro">Sem acesso a leads</Chip>}
            <Chip tom={m.papel === 'admin' ? 'marca' : 'neutro'}>{m.papel === 'admin' ? 'Administrador' : 'Membro'}</Chip>
          </div>
        ))}
        {membros.length === 0 && <p className="texto-2">Ninguém foi adicionado ainda. Como dono da agência, você já tem acesso total.</p>}
      </Cartao>

      {ehAdminCliente && convites.length > 0 && (
        <Cartao titulo="Convites pendentes">
          {convites.map((c) => (
            <div key={c.id} className="linha" style={{ gap: 12 }}>
              <span style={{ flex: 1 }}>{c.email ?? 'Link de uso único'}</span>
              {!c.acesso_leads && <Chip tom="neutro">Sem leads</Chip>}
              <span className="pequeno">vence {new Date(c.expira_em).toLocaleDateString('pt-BR')}</span>
              <Botao variante="fantasma" aria-label="Cancelar convite" onClick={() => void cancelar(c.id)}><Trash2 size={16} /></Botao>
            </div>
          ))}
        </Cartao>
      )}
    </div>
  )
}
