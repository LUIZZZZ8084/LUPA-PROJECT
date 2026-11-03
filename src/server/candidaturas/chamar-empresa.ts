import "server-only";

import { mensagemParaEmpresa } from "@/lib/chamada";
import { getJobById, getMyApplications } from "@/lib/data";
import { resolveContact } from "@/lib/demo";
import { whatsappLink } from "@/lib/format";
import { type Autenticado, pode } from "../auth/rbac";
import { repositorioUsuarios } from "../repositories";
import { urlPublica } from "../url-publica";

/**
 * O WhatsApp da empresa, com a mensagem pronta, para cada candidatura de
 * quem está logado (#533).
 *
 * O telefone da empresa só sai daqui para quem tem candidatura a uma vaga
 * dela, e é a candidatura que se procura — entre as **da própria sessão** —,
 * não um id de vaga vindo de fora. A vaga aberta ao público não mostra
 * contato (#490); pedir "o telefone da empresa da vaga X" por parâmetro
 * seria a porta dos fundos.
 *
 * A chave do resultado é o id da candidatura. Candidatura cuja vaga sumiu ou
 * cuja empresa não tem telefone fica de fora, e a tela não desenha botão que
 * não leva a lugar nenhum.
 */
export async function linksParaChamarAEmpresa(
  sessao: Autenticado,
): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  if (!pode(sessao.papel, "candidatura:ver_propria")) return links;

  const [candidaturas, eu] = await Promise.all([
    getMyApplications(sessao.usuarioId),
    repositorioUsuarios().porId(sessao.usuarioId),
  ]);
  if (!eu || candidaturas.length === 0) return links;

  const base = urlPublica();
  const linkDoPerfil = `${base}/candidatos/${sessao.usuarioId}`;

  await Promise.all(
    candidaturas.map(async (c) => {
      const vaga = await getJobById(c.job_id);
      if (!vaga) return;

      const dono = await repositorioUsuarios().porId(vaga.company_id);
      // Em demonstração a empresa é fictícia e o destino é o número do
      // fundador — o mesmo desvio do botão de contato do prestador.
      const { phone } = resolveContact(dono?.telefone ?? "");
      if (!phone) return;

      links.set(
        c.id,
        whatsappLink(
          phone,
          mensagemParaEmpresa({
            empresa: vaga.company.company_name,
            candidato: eu.nomeCompleto,
            vaga: c.job_title,
            linkDaVaga: `${base}/vagas/${c.job_id}`,
            linkDoPerfil,
          }),
        ),
      );
    }),
  );

  return links;
}
