import { useRef, useState } from 'react'
import { Camera, Check } from 'lucide-react'
import { Avatar, Cartao } from './ui'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import { reduzirImagem } from '../lib/imagens'

/** Nome e foto da pessoa: aparecem nos responsáveis dos cards, demandas, OS e na TV. */
export function MeuPerfil() {
  const { usuario, recarregar } = useSessao()
  const [nome, setNome] = useState(usuario.nome)
  const [foto, setFoto] = useState<string | null>(usuario.foto_url ?? null)
  const [enviando, setEnviando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const entrada = useRef<HTMLInputElement>(null)

  const avisarSalvo = () => { setSalvo(true); setTimeout(() => setSalvo(false), 1800) }

  async function trocarFoto(f: File | undefined) {
    if (!f) return
    setEnviando(true); setErro(null)
    try {
      const blob = await reduzirImagem(f, 400)
      if (!supabase) { setFoto(URL.createObjectURL(blob)); avisarSalvo(); return }
      const caminho = `${usuario.id}/${Date.now()}.webp`
      const { error } = await supabase.storage.from('perfis').upload(caminho, blob, { contentType: 'image/webp', cacheControl: '31536000' })
      if (error) throw new Error('Não foi possível enviar a foto.')
      const url = supabase.storage.from('perfis').getPublicUrl(caminho).data.publicUrl
      const antiga = foto?.split('/object/public/perfis/')[1]
      const r = await supabase.from('perfis').update({ foto_url: url }).eq('id', usuario.id)
      if (r.error) throw new Error('Não foi possível salvar a foto.')
      if (antiga) await supabase.storage.from('perfis').remove([decodeURIComponent(antiga)])
      setFoto(url); avisarSalvo(); await recarregar()
    } catch (e) { setErro((e as Error).message) } finally { setEnviando(false) }
  }

  async function salvarNome() {
    const n = nome.trim()
    if (!n || n === usuario.nome) { setNome(usuario.nome); return }
    if (supabase) {
      const r = await supabase.from('perfis').update({ nome: n }).eq('id', usuario.id)
      if (r.error) { setErro('Não foi possível salvar o nome.'); return }
      await recarregar()
    }
    avisarSalvo()
  }

  return (
    <Cartao titulo="Meu perfil" acao={salvo ? <span className="pequeno" style={{ color: 'var(--sucesso)', display: 'inline-flex', gap: 4 }}><Check size={14} /> Salvo</span> : undefined}>
      <div className="meu-perfil">
        <button type="button" className={`meu-perfil__foto${enviando ? ' enviando' : ''}`} onClick={() => entrada.current?.click()} aria-label="Trocar foto de perfil" title="Trocar foto">
          {foto ? <img src={foto} alt="" /> : <Avatar nome={usuario.nome || '?'} tamanho={72} cor="var(--marca)" />}
          <span className="meu-perfil__camera"><Camera size={15} /></span>
        </button>
        <input ref={entrada} type="file" accept="image/*" hidden onChange={(e) => { void trocarFoto(e.target.files?.[0]); e.target.value = '' }} />
        <div className="campo" style={{ flex: 1 }}>
          <label htmlFor="meu-nome">Seu nome</label>
          <input id="meu-nome" className="entrada" value={nome} onChange={(e) => setNome(e.target.value)} onBlur={() => void salvarNome()}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
          <span className="pequeno">A foto e o nome aparecem nos cards, demandas e OS em que você é responsável, e na TV da equipe.</span>
          {erro && <span className="pequeno" style={{ color: 'var(--perigo)' }}>{erro}</span>}
        </div>
      </div>
    </Cartao>
  )
}
