"use client";

import type { ChangeEvent } from "react";
import {
  conferirArquivo,
  type Especie,
  REGRAS,
} from "@/server/arquivos/regras";

/**
 * O arquivo escolhido cabe no envio — ou a pessoa sabe por que não, antes
 * de mandar (#324, #325).
 *
 * Dois defeitos com a mesma raiz: o limite só era conferido no servidor,
 * depois de o arquivo atravessar a rede.
 *
 * - **Foto de celular.** Tem de 3 a 8 MB, e o limite de imagem é 2 MB. O
 *   servidor já reduz a foto (#283), mas só depois que ela chega — e a de
 *   celular nem chegava. A pessoa precisava diminuir a foto por conta
 *   própria, o que quase ninguém sabe fazer no celular.
 * - **PDF grande.** A Vercel recusa corpo acima de 4,5 MB antes de a action
 *   existir, e a recusa aparecia como erro genérico, em inglês. Nenhuma
 *   mensagem nossa chegava a ser lida.
 *
 * Aqui, na hora em que a pessoa escolhe o arquivo: foto acima do limite é
 * reduzida no próprio aparelho, o que ainda economiza o dado móvel de quem
 * envia em 3G; o que não dá para reduzir é recusado com a mesma mensagem
 * que o servidor daria, ao lado do campo. **O servidor continua conferindo
 * e reduzindo tudo** — é ele que garante o formato e tira o GPS da foto, e
 * nada que vem do navegador é garantia.
 */

/** O lado maior da foto reduzida. O mesmo do feed, o maior que o servidor guarda. */
const LADO_MAXIMO = 1600;

/** Qualidade do WebP/JPEG: abaixo disso aparece artefato em foto de obra. */
const QUALIDADE = 0.85;

type Reduzir = (arquivo: File) => Promise<File | null>;

/**
 * Decide o que fazer com o arquivo escolhido.
 *
 * Separada da parte que mexe no `<input>` para ser testada sem navegador:
 * a redução é injetada.
 */
export async function prepararArquivo(
  arquivo: File,
  especie: Especie,
  reduzir: Reduzir = reduzirNoNavegador,
): Promise<{ arquivo: File } | { erro: string }> {
  const recusa = conferirArquivo(arquivo, especie);
  if (!recusa) return { arquivo };

  const imagem = REGRAS[especie].tiposAceitos.some((t) =>
    t.startsWith("image/"),
  );
  if (recusa.motivo !== "tamanho" || !imagem) return { erro: recusa.mensagem };

  /*
   * Reduzir pode falhar: formato que o navegador não decodifica, aparelho
   * antigo sem `createImageBitmap`, memória curta para uma foto enorme. Aí
   * vale a mensagem do limite, que é verdadeira — melhor que mandar e ver a
   * plataforma recusar sem explicação.
   */
  const reduzida = await reduzir(arquivo).catch(() => null);
  if (reduzida && !conferirArquivo(reduzida, especie)) {
    return { arquivo: reduzida };
  }
  return { erro: recusa.mensagem };
}

/**
 * Reduz a foto no aparelho: lado maior de 1600 px, WebP.
 *
 * WebP porque guarda transparência — a logo de uma empresa costuma ter — e
 * é o formato que o servidor grava. Navegador que não sabe gerar WebP
 * devolve PNG no lugar, sem avisar; nesse caso sai JPEG com fundo branco,
 * porque um PNG do tamanho original não resolveria nada.
 */
export async function reduzirNoNavegador(arquivo: File): Promise<File | null> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(
    1,
    LADO_MAXIMO / Math.max(bitmap.width, bitmap.height),
  );
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const contexto = tela.getContext("2d");
  if (!contexto) return null;

  const gerar = (tipo: string) =>
    new Promise<Blob | null>((ok) => tela.toBlob(ok, tipo, QUALIDADE));

  contexto.drawImage(bitmap, 0, 0, largura, altura);
  let blob = await gerar("image/webp");

  if (blob?.type !== "image/webp") {
    contexto.fillStyle = "#ffffff";
    contexto.fillRect(0, 0, largura, altura);
    contexto.drawImage(bitmap, 0, 0, largura, altura);
    blob = await gerar("image/jpeg");
  }
  bitmap.close();

  if (!blob) return null;
  const extensao = blob.type === "image/webp" ? "webp" : "jpg";
  const nome = arquivo.name.replace(/\.[^.]*$/, "") || "foto";
  return new File([blob], `${nome}.${extensao}`, { type: blob.type });
}

/**
 * O `onChange` de um `<input type="file">`, para uma espécie de arquivo.
 *
 * Enquanto a foto é reduzida, o campo fica inválido com "Preparando a
 * foto…": o navegador não deixa enviar o formulário nesse meio tempo, e
 * quem aperta "Enviar" depressa não manda a foto original sem querer.
 *
 * O arquivo reduzido entra no lugar do escolhido pelo `DataTransfer`, e o
 * formulário segue igual — o mesmo `name`, a mesma action.
 */
export function ajustarAoLimite(especie: Especie) {
  return async (evento: ChangeEvent<HTMLInputElement>) => {
    const campo = evento.currentTarget;
    campo.setCustomValidity("");
    const escolhido = campo.files?.[0];
    if (!escolhido) return;

    campo.setCustomValidity("Preparando a foto…");
    const resultado = await prepararArquivo(escolhido, especie);

    if ("erro" in resultado) {
      campo.setCustomValidity(resultado.erro);
      campo.reportValidity();
      return;
    }

    if (
      resultado.arquivo !== escolhido &&
      !trocarArquivo(campo, resultado.arquivo)
    ) {
      // Sem como trocar o arquivo, vale o limite: mandar o original seria
      // ver a recusa do servidor depois de gastar o dado móvel.
      campo.setCustomValidity(
        conferirArquivo(escolhido, especie)?.mensagem ?? "",
      );
      campo.reportValidity();
      return;
    }

    campo.setCustomValidity("");
  };
}

function trocarArquivo(campo: HTMLInputElement, arquivo: File): boolean {
  try {
    const transferencia = new DataTransfer();
    transferencia.items.add(arquivo);
    campo.files = transferencia.files;
    const agora = campo.files?.[0];
    return agora?.size === arquivo.size && agora.type === arquivo.type;
  } catch {
    return false;
  }
}
