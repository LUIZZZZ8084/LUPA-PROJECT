import {
  Banknote,
  Briefcase,
  Building2,
  Clock,
  MapPin,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { ApplyButton } from "@/components/apply-button";
import { BarraDeAcaoFixa } from "@/components/barra-de-acao-fixa";
import { CompartilharVaga } from "@/components/compartilhar-vaga";
import { Denunciar } from "@/components/denunciar";
import { JobCard } from "@/components/job-card";
import { BackLink, PageShell } from "@/components/layout/page-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { VerifiedMark } from "@/components/verified-badge";
import { ROTULO_PCD, WORK_MODE_LABELS } from "@/lib/constants";
import { empresaDoPainel, getJobById, getRelatedJobs } from "@/lib/data";
import {
  formatSalaryRange,
  linkExterno,
  pluralize,
  timeAgo,
  vagaExpirada,
} from "@/lib/format";
import { ehRastreador } from "@/lib/rastreador";
import { sessaoAtual } from "@/server/auth/cookies";
import { pode } from "@/server/auth/rbac";
import { contarVisualizacao } from "@/server/visualizacoes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const job = await getJobById(id);
  if (!job) return { title: "Vaga não encontrada" };

  /*
   * A prévia do link (#490): cargo, empresa, cidade e salário no título e
   * na descrição, e a miniatura vem de `opengraph-image.tsx`, ao lado.
   * Nada de contato — a página abre sem login, e o que ela mostra a quem
   * não tem conta é só isto.
   */
  const titulo = `${job.title} — ${job.company.company_name}`;
  const salario = formatSalaryRange(job.salary_min, job.salary_max);
  const descricao =
    `${job.company.company_name} · ${job.city}` +
    `${salario === "A combinar" ? "" : ` · ${salario}`}. ` +
    job.description.slice(0, 120);
  const aberta = job.status === "aberta" && !vagaExpirada(job.expires_at);

  return {
    title: titulo,
    description: descricao,
    openGraph: {
      title: titulo,
      description: descricao,
      type: "website",
      siteName: "Lupa",
      locale: "pt_BR",
    },
    // Vaga que já fechou não deve aparecer numa busca como se estivesse aberta.
    robots: aberta ? undefined : { index: false, follow: false },
  };
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJobById(id);
  if (!job) notFound();

  // Só http(s) vira link (#354): o endereço pode ter sido gravado antes de a
  // validação por esquema existir.
  const redes = {
    site: linkExterno(job.company.site),
    instagram: linkExterno(job.company.instagram),
    facebook: linkExterno(job.company.facebook),
  };

  /*
   * A contagem sai por `after()`, depois da resposta: quem abriu a vaga
   * quer ler a vaga, e o número é do outro lado do balcão. Sem isso, o
   * insert entraria no caminho crítico de uma página que muita gente abre
   * em 3G.
   *
   * A própria empresa não conta. Ela abre a vaga para conferir o texto, e
   * uma métrica que sobe quando o dono recarrega mede o dono, não o
   * público. **E o robô de prévia também não** (#490): a vaga abre sem
   * login, e colar o link no WhatsApp manda um servidor buscar a página —
   * contar isso faria o número subir quando a empresa divulga.
   */
  const sessao = await sessaoAtual();
  const podeCandidatar = Boolean(
    sessao && pode(sessao.papel, "candidatura:criar"),
  );
  const robo = ehRastreador((await headers()).get("user-agent"));
  if (sessao?.usuarioId !== job.company_id && !robo) {
    after(() => contarVisualizacao(job.id));
  }

  /*
   * Quem publicou a vaga: a empresa, ou o prestador que contrata. Em
   * demonstração toda conta de contratante é a empresa fictícia, e
   * `empresaDoPainel` faz essa tradução — o mesmo que o painel usa.
   */
  const ehDono = Boolean(
    sessao &&
      pode(sessao.papel, "vaga:publicar") &&
      empresaDoPainel(sessao.usuarioId) === job.company_id,
  );
  const destino = `/vagas/${job.id}`;

  const related = await getRelatedJobs(job);
  const expirada = job.status === "aberta" && vagaExpirada(job.expires_at);
  // Aberta, no prazo e com quem pode candidatar-se: é quando o botão existe.
  const abertaParaCandidatar =
    job.status === "aberta" && !expirada && podeCandidatar;

  return (
    <PageShell width="colunas">
      {/*
        Sem sessão, "voltar para vagas" levaria ao login: a lista continua
        fechada, só esta página abre (#490). O link volta para a home.
      */}
      <BackLink
        href={sessao ? "/vagas" : "/"}
        label={sessao ? "Voltar para vagas" : "Conhecer a Lupa"}
      />

      {ehDono && job.status === "aberta" && !expirada && (
        <CompartilharVaga
          vagaId={job.id}
          cargo={job.title}
          cidade={job.city}
          empresa={job.company.company_name}
        />
      )}

      {/*
        No computador (#525) a vaga vira duas colunas: a descrição à esquerda
        e, à direita, o cartão da candidatura preso embaixo do cabeçalho. Os
        dois invólucros são `contents` no celular e no tablet, ou seja, não
        existem como caixa: o painel, a barra e o "Denunciar" continuam filhos
        diretos do `<main>`, e a barra fixa do celular segue contida pelo
        mesmo bloco de antes (#479).
      */}
      <div className="contents lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-x-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Panel>
          <div className="flex items-start gap-4">
            <Avatar
              name={job.company.company_name}
              src={job.company.logo_url}
              size="lg"
              square
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-xl leading-tight font-bold sm:text-2xl">
                {job.title}
              </h1>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
                <Building2 size={14} />
                {job.company.company_name}
                {job.company.doc_verified && <VerifiedMark size={14} />}
              </p>

              {/*
               * No detalhe a frase é inteira, porque é aqui que a pessoa
               * decide se se candidata (#129). Produtor rural e autônomo
               * contratam de verdade — o que a frase faz é dizer o que a
               * verificação alcançou, sem sugerir que a vaga vale menos.
               */}
              {job.company.pessoa_fisica && (
                <p className="mt-1 text-xs text-faint">
                  Contratação por pessoa física, não por empresa registrada.
                </p>
              )}

              {/*
              Site e redes da empresa são contato, e contato é de quem tem
              conta (#490): a vaga aberta ao público mostra cargo, empresa
              e local, e o resto pede entrar.
            */}
              {sessao && (redes.site || redes.instagram || redes.facebook) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {redes.site && (
                    <a
                      href={redes.site}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="-my-3.5 inline-flex items-center py-3.5 text-xs text-muted underline-offset-2 transition-colors hover:text-vagas hover:underline"
                    >
                      Site
                    </a>
                  )}
                  {redes.instagram && (
                    <a
                      href={redes.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="-my-3.5 inline-flex items-center py-3.5 text-xs text-muted underline-offset-2 transition-colors hover:text-vagas hover:underline"
                    >
                      Instagram
                    </a>
                  )}
                  {redes.facebook && (
                    <a
                      href={redes.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="-my-3.5 inline-flex items-center py-3.5 text-xs text-muted underline-offset-2 transition-colors hover:text-vagas hover:underline"
                    >
                      Facebook
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact
              icon={<Banknote size={15} />}
              label="Salário"
              value={formatSalaryRange(job.salary_min, job.salary_max)}
              accent="text-vagas"
            />
            <Fact
              icon={<MapPin size={15} />}
              label="Local"
              value={
                job.neighborhood ? `${job.neighborhood}, ${job.city}` : job.city
              }
            />
            <Fact
              icon={<Briefcase size={15} />}
              label="Contrato"
              value={job.contract_type ?? "A combinar"}
            />
            <Fact
              icon={<Clock size={15} />}
              label="Publicada"
              value={timeAgo(job.created_at)}
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {job.category && <Badge tone="vagas">{job.category}</Badge>}
            {job.work_mode && (
              <Badge tone="outline">{WORK_MODE_LABELS[job.work_mode]}</Badge>
            )}
            {job.for_pcd && <Badge tone="vagas">{ROTULO_PCD}</Badge>}
            <Badge tone="outline">
              <Users size={11} />
              {pluralize(job.applicant_count, "candidato", "candidatos")}
            </Badge>
            {job.status === "fechada" && (
              <Badge tone="danger">Vaga fechada</Badge>
            )}
            {expirada && <Badge tone="neutral">Vaga expirada</Badge>}
          </div>

          {job.address && (
            <div className="mt-6 border-t border-line pt-5">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <MapPin size={15} className="text-vagas" />
                Endereço
              </h2>
              <p className="text-sm text-muted">{job.address}</p>
            </div>
          )}

          <div className="mt-6 border-t border-line pt-5">
            <h2 className="mb-3 text-sm font-semibold">Sobre a vaga</h2>
            <div className="space-y-3 text-sm leading-relaxed text-muted">
              {job.description.split("\n\n").map((paragraph) => (
                <p key={paragraph.slice(0, 48)}>{paragraph}</p>
              ))}
            </div>
          </div>

          {/*
          Só as mensagens ficam no painel. O botão de candidatar-se vive na
          barra fixa logo abaixo (#479): no fim do painel ele ficava mais de
          mil pixels abaixo do topo no celular.
        */}
          {!abertaParaCandidatar && (
            <div className="mt-6 border-t border-line pt-5">
              {job.status !== "aberta" || expirada ? (
                <div className="text-center">
                  <p className="text-muted text-sm">
                    Esta vaga não está mais recebendo candidaturas.
                  </p>
                  {/*
                  Quem chegou por um link velho precisa de um caminho: as
                  vagas da cidade. Sem sessão a lista pede entrar, e volta
                  para a mesma busca depois.
                */}
                  <ButtonLink
                    href={`/vagas?cidade=${encodeURIComponent(job.city)}`}
                    variant="vagas"
                    size="sm"
                    className="mt-3"
                  >
                    Ver vagas em {job.city}
                  </ButtonLink>
                </div>
              ) : !sessao ? (
                /*
                 * Aberta, e a pessoa ainda não tem conta (#490): o convite
                 * está na barra de baixo, e aqui não sobra nada a dizer.
                 */
                <p className="text-center text-muted text-sm">
                  Entre ou crie uma conta para se candidatar.
                </p>
              ) : (
                /*
                 * Sem a capacidade, nada de botão.
                 *
                 * Ele aparecia para todo mundo e só recusava depois do clique
                 * — inclusive para empresa e para quem virou prestador. É a
                 * mesma armadilha que os atalhos do perfil já evitam:
                 * "mostrar um link que devolve sem permissão ao ser clicado é
                 * pior do que não mostrar; a pessoa conclui que o app está
                 * quebrado". Aqui era pior ainda, porque a tela de virar
                 * prestador promete que este botão some.
                 */
                <p className="text-center text-muted text-sm">
                  Contas de prestador e de empresa não se candidatam a vagas.
                </p>
              )}
            </div>
          )}
        </Panel>

        <div className="contents lg:sticky lg:top-24 lg:block">
          {abertaParaCandidatar && (
            <BarraDeAcaoFixa>
              <ApplyButton
                jobId={job.id}
                perguntas={job.screening_questions ?? []}
              />
            </BarraDeAcaoFixa>
          )}

          {/*
        Sem conta: entrar ou criar uma, e voltar para esta mesma vaga. O
        `destino` é validado por `destinoSeguro` do outro lado, então um
        caminho nosso não vira trampolim.
      */}
          {!sessao && job.status === "aberta" && !expirada && (
            <BarraDeAcaoFixa>
              <div className="space-y-2">
                <ButtonLink
                  href={`/entrar?destino=${encodeURIComponent(destino)}`}
                  variant="vagas"
                  size="lg"
                  block
                >
                  Entrar para se candidatar
                </ButtonLink>
                <p className="text-center text-muted text-xs">
                  Ainda não tem conta?{" "}
                  <Link
                    href={`/cadastro?tipo=candidato_clt&destino=${encodeURIComponent(destino)}`}
                    className="-my-3 inline-flex items-center py-3 font-medium text-vagas underline-offset-2 hover:underline"
                  >
                    Criar conta grátis
                  </Link>
                </p>
              </div>
            </BarraDeAcaoFixa>
          )}

          {/*
        Denunciar (#435): para quem tem sessão e não é o dono. Fica fora do
        painel da vaga e discreto — é recurso de exceção, e não pode
        disputar atenção com "Candidatar-se".
      */}
          {sessao &&
            pode(sessao.papel, "denuncia:criar") &&
            sessao.usuarioId !== job.company_id && (
              <div className="mt-3 flex justify-end">
                <Denunciar alvo="vaga" alvoId={job.id} />
              </div>
            )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-base font-bold">Vagas parecidas</h2>
          <div className="grid-cols-1 space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-2.5 lg:space-y-0 xl:grid-cols-3">
            {related.map((r) => (
              <JobCard key={r.id} job={r} />
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
}

function Fact({
  icon,
  label,
  value,
  accent = "text-ink",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel-2 p-3">
      <p className="flex items-center gap-1.5 text-xs text-faint">
        {icon}
        {label}
      </p>
      <p className={`mt-1 text-[13px] font-semibold ${accent}`}>{value}</p>
    </div>
  );
}
