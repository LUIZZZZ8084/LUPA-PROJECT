import { Briefcase, Building2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JobCard } from "@/components/job-card";
import {
  BackLink,
  EmptyState,
  PageShell,
} from "@/components/layout/page-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { VerifiedMark } from "@/components/verified-badge";
import {
  getCompany,
  getCompanyJobs,
  getPerfilPublicoDaEmpresa,
} from "@/lib/data";
import { linkExterno, pluralize, vagaExpirada } from "@/lib/format";
import { sessaoAtual } from "@/server/auth/cookies";

/**
 * A página pública da empresa (#616).
 *
 * O nome da empresa na vaga leva até aqui: quem lê uma vaga quer saber quem
 * contrata e o que mais ela oferece. Abre sem login, como a vaga (#490), e
 * pela mesma regra o site e as redes — que são contato — só aparecem para
 * quem tem conta.
 *
 * **O cabeçalho sai das vagas**, quando há: elas já trazem nome, logo, selo
 * e redes como a vaga as mostra, e a página diz o mesmo que a vaga disse.
 * Sem vaga nenhuma, o nome e a logo vêm do cadastro. Sem cadastro, 404.
 *
 * Só as vagas no ar: encerrada, vencida ou removida pela moderação não é
 * oferta, e listá-la convidaria a se candidatar ao que não existe.
 */
async function carregar(id: string) {
  const [vagas, perfil] = await Promise.all([
    getCompanyJobs(id),
    getPerfilPublicoDaEmpresa(id),
  ]);
  if (!perfil) return null;

  const daVaga = vagas[0]?.company;
  const doCadastro = daVaga ? null : await getCompany(id);
  if (!daVaga && !doCadastro) return null;

  return {
    nome: daVaga?.company_name ?? doCadastro?.company_name ?? "Empresa",
    logo: daVaga?.logo_url ?? doCadastro?.logo_url ?? null,
    verificada: daVaga?.doc_verified ?? false,
    pessoaFisica: daVaga?.pessoa_fisica ?? false,
    site: linkExterno(daVaga?.site ?? null),
    instagram: linkExterno(daVaga?.instagram ?? null),
    facebook: linkExterno(daVaga?.facebook ?? null),
    ...perfil,
    abertas: vagas.filter(
      (v) =>
        v.status === "aberta" && !vagaExpirada(v.expires_at) && !v.removed_at,
    ),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const empresa = await carregar((await params).id);
  if (!empresa) return { title: "Empresa não encontrada" };
  return {
    title: `${empresa.nome} — vagas na Lupa`,
    description:
      empresa.descricao?.slice(0, 155) ??
      `${pluralize(empresa.abertas.length, "vaga aberta", "vagas abertas")} de ${empresa.nome} na Lupa.`,
  };
}

export default async function EmpresaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [empresa, sessao] = await Promise.all([carregar(id), sessaoAtual()]);
  if (!empresa) notFound();

  const redes = [
    ["Site", empresa.site],
    ["Instagram", empresa.instagram],
    ["Facebook", empresa.facebook],
  ].filter((r): r is [string, string] => Boolean(r[1]));

  return (
    <PageShell>
      <BackLink href="/vagas" label="Ver todas as vagas" />

      <Panel className="mb-6">
        <div className="flex items-start gap-4">
          <Avatar name={empresa.nome} src={empresa.logo} size="xl" square />
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 font-bold text-2xl leading-tight">
              {empresa.nome}
              {empresa.verificada && <VerifiedMark size={20} />}
            </h1>
            {(empresa.setor || empresa.porte) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {empresa.setor && (
                  <Badge tone="empresas">{empresa.setor}</Badge>
                )}
                {empresa.porte && (
                  <Badge tone="neutral">
                    Porte {empresa.porte.toLowerCase()}
                  </Badge>
                )}
              </div>
            )}
            {empresa.pessoaFisica && (
              <p className="mt-2 text-faint text-xs">
                Contratação por pessoa física, não por empresa registrada.
              </p>
            )}
          </div>
        </div>

        {empresa.descricao && (
          <p className="mt-5 text-muted text-sm leading-relaxed">
            {empresa.descricao}
          </p>
        )}

        {/* Site e redes são contato, e contato é de quem tem conta (#490). */}
        {sessao && redes.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-line border-t pt-3">
            {redes.map(([rotulo, href]) => (
              <a
                key={rotulo}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="-my-3 inline-flex items-center py-3 text-muted text-sm underline-offset-2 transition-colors hover:text-empresas hover:underline"
              >
                {rotulo}
              </a>
            ))}
          </div>
        )}
      </Panel>

      <h2 className="mb-3 flex items-center gap-2 font-bold text-base">
        <Briefcase size={18} className="text-vagas" aria-hidden />
        {empresa.abertas.length === 0
          ? "Vagas abertas"
          : pluralize(empresa.abertas.length, "vaga aberta", "vagas abertas")}
      </h2>
      {empresa.abertas.length === 0 ? (
        <EmptyState
          icon={<Building2 size={22} />}
          title="Nenhuma vaga aberta agora"
          description="Quando esta empresa publicar uma vaga, ela aparece aqui e na busca de vagas."
        />
      ) : (
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {empresa.abertas.map((vaga) => (
            <JobCard key={vaga.id} job={vaga} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
