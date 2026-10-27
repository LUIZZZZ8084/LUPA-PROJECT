import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { ArteDaVaga, dadosDaImagem } from "@/components/brand/imagem-da-vaga";
import { empresaDoPainel, getJobById } from "@/lib/data";
import { sessaoAtual } from "@/server/auth/cookies";
import { consumirOrcamento } from "@/server/auth/rate-limit";
import { pode } from "@/server/auth/rbac";
import { comoAppError } from "@/server/errors";
import { ORCAMENTO_DA_ARTE_DA_VAGA } from "@/server/limites";
import { cronometro, log, novoRequestId } from "@/server/logger";
import { urlPublica } from "@/server/url-publica";

export const dynamic = "force-dynamic";

/** A arte de story e status da vaga, 1080 × 1920, para a empresa baixar (#490). */
const TAMANHO = { width: 1080, height: 1920 };

/**
 * Devolve a arte vertical de uma vaga **só para quem a publicou**.
 *
 * O que está na imagem é público — a página da vaga mostra o mesmo —, mas a
 * rota é de dono: é a empresa que a pede, de dentro do app, e uma imagem de
 * 1080 × 1920 renderizada a cada chamada é trabalho que não se oferece a
 * qualquer anônimo. Vaga de outra empresa responde 404, igual a "não existe":
 * 403 confirmaria que o id existe.
 *
 * O teto é do mesmo tipo do currículo em PDF: um `GET` que o de
 * `criarAcao` não alcança, e o pedido mais caro de CPU depois dele.
 */
export async function GET(
  _pedido: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = novoRequestId();
  const medir = cronometro();

  try {
    const sessao = await sessaoAtual();
    if (!sessao || !pode(sessao.papel, "vaga:publicar")) {
      return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
    }

    const { id } = await params;
    const job = await getJobById(id);
    if (!job || job.company_id !== empresaDoPainel(sessao.usuarioId)) {
      return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
    }

    await consumirOrcamento(
      `acao:vaga.arte:u:${sessao.usuarioId}`,
      ORCAMENTO_DA_ARTE_DA_VAGA,
    );

    log.info("arte da vaga gerada", {
      requestId,
      acao: "vaga.arte",
      ms: medir(),
    });

    return new ImageResponse(
      <ArteDaVaga
        vaga={dadosDaImagem(job)}
        endereco={new URL(urlPublica()).host}
      />,
      {
        ...TAMANHO,
        headers: {
          "Content-Disposition": 'attachment; filename="vaga-lupa.png"',
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (e) {
    const erro = comoAppError(e);
    log.erro(erro, { requestId, acao: "vaga.arte", ms: medir() });
    return NextResponse.json(erro.paraCliente(), { status: erro.status });
  }
}
