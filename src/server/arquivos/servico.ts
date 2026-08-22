import "server-only";

import { clienteDeServico, temChaveDeServico } from "@/lib/supabase/service";
import { erros } from "../errors";
import {
  caminhoDoArquivo,
  conferirArquivo,
  type Especie,
  REGRAS,
} from "./regras";

/**
 * Envio e remoção de arquivos.
 *
 * Tudo passa pela chave de serviço, no servidor. O navegador nunca fala com
 * o Storage direto: fosse assim, quem pode enviar e para onde viraria
 * responsabilidade de uma policy, e uma policy errada é silenciosa até
 * alguém sobrescrever o arquivo de outra pessoa.
 *
 * O currículo mora em bucket privado; a leitura sai por URL assinada de
 * curta duração, gerada aqui.
 */

/** Quanto tempo uma URL de currículo vale. */
const VALIDADE_ASSINATURA_SEGUNDOS = 60;

/**
 * Sem Supabase não há Storage.
 *
 * O modo demonstração roda com repositório em memória, e não existe
 * equivalente para arquivo. Dizer isso é melhor do que aceitar o envio e
 * perder o arquivo em silêncio — a pessoa acharia que salvou.
 */
export const temArmazenamento = temChaveDeServico;

export interface ArquivoEnviado {
  /** URL pública, ou o caminho no bucket quando privado. */
  referencia: string;
}

export async function enviarArquivo(
  usuarioId: string,
  especie: Especie,
  arquivo: File,
): Promise<ArquivoEnviado> {
  if (!temArmazenamento) {
    throw erros.indisponivel(
      "o envio de arquivos precisa do Supabase configurado",
    );
  }

  /*
   * O erro é atribuído ao campo do arquivo, não à tela toda: assim ele
   * aparece embaixo do seletor que a pessoa acabou de usar, e não como um
   * aviso solto que não diz o que corrigir.
   */
  const recusa = conferirArquivo(arquivo, especie);
  if (recusa) {
    throw erros.validacao(
      [{ campo: "arquivo", mensagem: recusa.mensagem }],
      recusa.mensagem,
    );
  }

  const regra = REGRAS[especie];
  const caminho = caminhoDoArquivo(usuarioId, especie, arquivo.type);

  const supabase = clienteDeServico();
  if (!supabase) throw erros.indisponivel("cliente de armazenamento");

  const { error } = await supabase.storage
    .from(regra.balde)
    .upload(caminho, arquivo, {
      contentType: arquivo.type,
      /*
       * Sobrescreve: o caminho é fixo por pessoa, então trocar a foto
       * substitui a anterior em vez de acumular versões que ninguém apaga
       * e que continuam custando armazenamento.
       */
      upsert: true,
    });

  if (error) throw erros.indisponivel(`envio de arquivo: ${error.message}`);

  if (!regra.publico) return { referencia: caminho };

  const { data } = supabase.storage.from(regra.balde).getPublicUrl(caminho);

  /*
   * A marca de tempo força o navegador a buscar de novo. Sem ela, trocar a
   * foto não muda a URL, e a pessoa continua vendo a antiga em cache —
   * concluindo que o envio falhou.
   */
  return { referencia: `${data.publicUrl}?v=${Date.now()}` };
}

export async function removerArquivo(
  usuarioId: string,
  especie: Especie,
): Promise<void> {
  if (!temArmazenamento) return;

  const supabase = clienteDeServico();
  if (!supabase) return;

  const regra = REGRAS[especie];

  /*
   * Remove todas as extensões possíveis: a pessoa pode ter enviado PNG e
   * agora estar apagando depois de trocar por JPG. Deixar o antigo no
   * bucket é pagar por lixo que ninguém alcança.
   */
  const caminhos = Object.values(regra.extensoes).map(
    (ext) => `${regra.pasta}/${usuarioId}.${ext}`,
  );

  await supabase.storage.from(regra.balde).remove(caminhos);
}

/**
 * URL temporária para um arquivo privado.
 *
 * Devolve null quando não há arquivo ou quando o Storage não está
 * configurado — a tela trata isso como "ainda não enviado".
 */
export async function urlAssinada(
  caminho: string | null,
): Promise<string | null> {
  if (!caminho || !temArmazenamento) return null;

  const supabase = clienteDeServico();
  if (!supabase) return null;

  const { data, error } = await supabase.storage
    .from(REGRAS.curriculo.balde)
    .createSignedUrl(caminho, VALIDADE_ASSINATURA_SEGUNDOS);

  if (error) return null;
  return data?.signedUrl ?? null;
}
