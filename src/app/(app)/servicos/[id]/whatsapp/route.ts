import { NextResponse } from "next/server";
import { buildContact } from "@/lib/contato-whatsapp";
import { getProviderById } from "@/lib/data";
import { whatsappLink } from "@/lib/format";
import { sessaoAtual } from "@/server/auth/cookies";
import { contarNoPerfil } from "@/server/contagens-prestador";

/**
 * "Conversar no WhatsApp" passa por aqui (#604): conta a chamada e
 * redireciona para o mesmo `wa.me` que o botão montava.
 *
 * Uma rota, e não um `sendBeacon` no clique, porque conta mesmo sem
 * JavaScript e no navegador embutido de rede social, que é por onde boa
 * parte do público abre o app. Fica atrás do login pelo proxy, como o
 * contato sempre esteve: sem sessão, o telefone não é lido.
 *
 * O próprio prestador não conta — ele testa o botão, e métrica que sobe
 * quando o dono clica mede o dono.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sessao = await sessaoAtual();
  const prestador = await getProviderById(id);
  if (!sessao || !prestador) {
    return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
  }

  const { phone, message } = buildContact(
    prestador.phone,
    prestador.full_name,
    prestador.category.name,
  );
  // Demonstração sem número configurado: volta para o perfil.
  if (!phone) {
    return NextResponse.redirect(
      new URL(`/servicos/${encodeURIComponent(id)}`, _request.url),
    );
  }

  if (sessao.usuarioId !== prestador.profile_id) {
    await contarNoPerfil(prestador.profile_id, "contato");
  }

  return NextResponse.redirect(whatsappLink(phone, message), {
    headers: { "Cache-Control": "no-store" },
  });
}
