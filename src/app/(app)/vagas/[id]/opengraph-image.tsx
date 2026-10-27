import { ImageResponse } from "next/og";
import { CartaoDaVaga, dadosDaImagem } from "@/components/brand/imagem-da-vaga";
import { getJobById } from "@/lib/data";

export const alt = "Vaga na Lupa";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * A miniatura do link da vaga, quando alguém o cola no WhatsApp, no
 * Instagram ou no Facebook (#490).
 *
 * Sem ela a prévia era duas linhas de texto — e o link da vaga anda
 * justamente por esses três, que é onde as vagas da cidade já são
 * divulgadas. Mostra cargo, empresa, cidade e salário: o que a página
 * pública já mostra, e nada de contato.
 *
 * Quem busca a imagem é o servidor da rede social, sem sessão; por isso a
 * rota está aberta no `proxy.ts`, junto da página. Vaga que não existe cai
 * na miniatura genérica da Lupa em vez de um erro: a prévia de um link
 * velho não deve ser uma imagem quebrada.
 */
export default async function ImagemDaVaga({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJobById(id);

  const vaga = job
    ? dadosDaImagem(job)
    : {
        cargo: "Vaga na Lupa",
        empresa: "Trabalho perto de você",
        cidade: "Brasil",
        endereco: null,
        salario: null,
        contrato: null,
      };

  return new ImageResponse(<CartaoDaVaga vaga={vaga} />, size);
}
