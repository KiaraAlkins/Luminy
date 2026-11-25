import { supabase } from './supabase'

/** Reduz a imagem no navegador (lado maior em px, WebP) antes de enviar: sobe rápido e ocupa pouco. */
export async function reduzirImagem(arquivo: File, lado = 512): Promise<Blob> {
  if (!arquivo.type.startsWith('image/')) throw new Error('Escolha uma imagem (JPG, PNG ou WebP).')
  const bmp = await createImageBitmap(arquivo)
  const escala = Math.min(1, lado / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * escala); c.height = Math.round(bmp.height * escala)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return new Promise((ok, erro) => c.toBlob((b) => (b ? ok(b) : erro(new Error('Imagem inválida'))), 'image/webp', 0.86))
}

const paraDataUrl = (b: Blob) => new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(b) })

/**
 * Envia a imagem para o armazenamento "empresas" (pasta do cliente) e devolve o link público.
 * Sem Supabase (modo demonstração), devolve a imagem embutida.
 */
export async function enviarImagem(caminho: string, arquivo: File): Promise<string> {
  const blob = await reduzirImagem(arquivo)
  if (!supabase) return paraDataUrl(blob)
  const arquivoFinal = `${caminho}-${Date.now()}.webp`
  const { error } = await supabase.storage.from('empresas').upload(arquivoFinal, blob, { contentType: 'image/webp', cacheControl: '31536000' })
  if (error) throw new Error('Não foi possível enviar a imagem.')
  return supabase.storage.from('empresas').getPublicUrl(arquivoFinal).data.publicUrl
}

/** Apaga do armazenamento uma imagem antiga (pelo link público). */
export async function apagarImagem(url: string | null | undefined) {
  const caminho = url?.split('/object/public/empresas/')[1]
  if (supabase && caminho) await supabase.storage.from('empresas').remove([decodeURIComponent(caminho)])
}
