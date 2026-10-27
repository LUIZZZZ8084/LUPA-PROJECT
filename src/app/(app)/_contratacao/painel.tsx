import {
  Building2,
  FileText,
  Inbox,
  MessageCircle,
  Plus,
  Ticket,
  UserSearch,
  Users,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  EmptyState,
  PageShell,
  PageTitle,
} from "@/components/layout/page-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Panel, Stat } from "@/components/ui/card";
import { VerifiedMark } from "@/components/verified-badge";
import { mensagemParaCandidato } from "@/lib/chamada";
import {
  empresaDoPainel,
  getCompany,
  getCompanyApplications,
  getCompanyJobs,
  getCompanyStats,
} from "@/lib/data";
import {
  pluralize,
  prazoDaVaga,
  timeAgo,
  vagaExpirada,
  whatsappLink,
} from "@/lib/format";
import { resumoDoDireito, seloDoDireito } from "@/lib/planos-empresa";
import {
  LIMIAR_MUITO_COMPATIVEL,
  resultadosDasVagas,
} from "@/lib/resultado-da-vaga";
import { motivosDeNaoAtender } from "@/lib/triagem";
import { sessaoOuEntrar } from "@/server/auth/cookies";
import { pode } from "@/server/auth/rbac";
import {
  type MatchDaCandidatura,
  matchPorCandidatura,
} from "@/server/candidaturas/match";
import { recomendadosParaEmpresa } from "@/server/candidaturas/recomendados";
import { direitoDePublicar } from "@/server/carteiras/servico";
import {
  serieDoPainel,
  temPainelDeEmpresa,
  totaisDaSerie,
  visualizacoesPorVaga,
} from "@/server/visualizacoes/servico";
import { type AreaDeContratacao, areaDoPapel } from "./area";
import { EncerrarVagaButton } from "./encerrar-vaga-button";
import { MoverCandidaturaSelect } from "./mover-candidatura-select";
import { ReativarVagaButton } from "./reativar-vaga-button";
import { Recomendados } from "./recomendados";
import { ResultadoDaVagaLinha } from "./resultado-da-vaga";
import { SerieGrafico } from "./serie-grafico";

/**
 * O quanto o candidato casa com a vaga a que se candidatou.
 *
 * Sem match no mapa, não desenha nada: a vaga não declarou habilidade e o
 * título não deu pista. Mostrar "0%" ali seria afirmar que o candidato não
 * tem nada do que se pede, quando a verdade é que ninguém disse o que se
 * pede.
 *
 * O número vive no `aria-label` por extenso porque o selo mostra só
 * "72%", e "72%" sozinho não diz de quê — nem para quem usa leitor de
 * tela, nem para quem está no celular, onde `title` não existe. Quem
 * quiser o detalhe abre a ficha.
 */
function SeloDeMatch({ match }: { match: MatchDaCandidatura | undefined }) {
  if (!match) return null;

  const tone =
    match.porcentagem >= LIMIAR_MUITO_COMPATIVEL
      ? "vagas"
      : match.porcentagem >= 40
        ? "warn"
        : "neutral";

  return (
    <Badge
      tone={tone}
      className="flex-none"
      aria-label={`Combina com ${match.pontos} de ${match.deQuantas} habilidades que a vaga pede`}
    >
      {match.porcentagem}%
    </Badge>
  );
}

export async function PainelDeContratacao({
  area,
}: {
  area: AreaDeContratacao;
}) {
  const sessao = await sessaoOuEntrar(area.base);

  /*
   * O painel é "minha empresa", e quem não tem empresa não tem painel.
   *
   * A página lia a sessão e nunca conferia o papel: qualquer conta
   * autenticada — candidato, prestador — abria daqui. Não vazava dado, e
   * é por isso que ninguém viu: em produção `empresaDoPainel()` devolve o
   * id de quem está pedindo, então as consultas voltam vazias, e publicar
   * já barrava na capacidade dentro da action. O que faltava era o
   * portão, e portão que falta é o que a próxima página criada aqui
   * embaixo herda.
   *
   * 404 e não 403, como no resto da casa. O admin também cai aqui de
   * propósito: ele enxerga tudo pelo `/admin/painel`, e uma empresa
   * própria é justamente o que ele não tem.
   */

  /*
   * Cada porta atende o próprio papel (#189).
   *
   * A implementação é a mesma, mas as duas áreas não são intercambiáveis:
   * uma empresa em `/contratar` leria "Contratar" no lugar do nome dela, e
   * um prestador em `/empresa` volta a ver a área escrita para quem tem
   * CNPJ — que é exatamente o que esta separação veio desfazer. O
   * candidato não cai aqui: ele segue para a explicação logo abaixo.
   */
  const areaDaPessoa = areaDoPapel(sessao.papel);
  if (areaDaPessoa && areaDaPessoa.base !== area.base) {
    redirect(`${areaDaPessoa.base}`);
  }

  /*
   * Candidato não é barrado com 404 — recebe a explicação.
   *
   * A barra inferior mostra "Empresa" para todo mundo, e antes o toque
   * dava página não encontrada. Não há segredo a proteger aqui: que exista
   * um painel de quem contrata é evidente pela própria navegação. O que
   * faltava era dizer o que é preciso para usá-lo.
   */
  if (!pode(sessao.papel, "vaga:ver_candidaturas_proprias")) {
    return (
      <PageShell width="narrow">
        <PageTitle
          title="Contratar pela Lupa"
          accent="text-empresas"
          description="Esta área é de quem contrata: publica vaga, recebe currículo e acompanha as candidaturas."
        />
        <Panel>
          <div className="flex items-start gap-3">
            <Building2 size={20} className="mt-0.5 flex-none text-empresas" />
            <div>
              <h2 className="font-bold text-base">
                Sua conta ainda não contrata
              </h2>
              <p className="mt-1.5 text-muted text-sm leading-relaxed">
                Contas de candidato usam a Lupa para procurar vaga e
                profissional. Para contratar, é preciso um perfil de contratante
                — empresa, produtor rural ou autônomo que emprega.
              </p>
              <p className="mt-3 text-faint text-sm leading-relaxed">
                Ainda não dá para criar esse perfil por aqui. Fale com a gente e
                resolvemos no suporte.
              </p>
            </div>
          </div>
        </Panel>
      </PageShell>
    );
  }

  const companyId = empresaDoPainel(sessao.usuarioId);
  const [company, jobs, applications, stats, serie, porVaga, recomendados] =
    await Promise.all([
      getCompany(companyId),
      getCompanyJobs(companyId),
      getCompanyApplications(companyId),
      getCompanyStats(companyId),
      // Quem não é empresa cai no estado vazio logo abaixo; pedir a série
      // antes disso trocaria a explicação por uma tela de erro.
      temPainelDeEmpresa(sessao) ? serieDoPainel(sessao) : [],
      temPainelDeEmpresa(sessao)
        ? visualizacoesPorVaga(sessao)
        : new Map<string, number>(),
      recomendadosParaEmpresa(sessao),
    ]);
  const totais = totaisDaSerie(serie);
  const match = matchPorCandidatura(applications, jobs);
  // O resultado de cada vaga (#492): visualizações, candidaturas e quantas
  // combinam com o que a vaga pede, juntos, no fim da linha dela.
  const resultados = resultadosDasVagas(jobs, applications, match, porVaga);
  const direito = await direitoDePublicar(sessao.usuarioId);
  const resumoDoPlano = resumoDoDireito(direito);

  /*
   * Sem perfil de contratante, e a tela diz coisas diferentes por papel.
   *
   * **Esta tela oferecia "Cadastrar empresa" apontando para
   * `/cadastro?tipo=empresa`** — o formulário de criar conta **nova**. Para
   * o prestador isso era uma armadilha cara: `garantirPerfilDeContratante`
   * só cria o perfil dele na primeira vaga publicada, então ele chegava
   * aqui sem perfil, era mandado criar outra conta, e o saldo de vagas que
   * já tinha comprado ficava preso na primeira — a carteira é por
   * `usuario_id`. Ele pagaria duas vezes sem entender por quê (#189).
   *
   * Para o prestador, não ter perfil aqui é **normal**: ele só ainda não
   * contratou ninguém. O convite certo é publicar a primeira vaga, e o
   * perfil nasce junto com ela.
   *
   * Para uma conta de empresa, é estado quebrado de verdade — ela ganha o
   * perfil no próprio cadastro. Aí o caminho é o suporte, nunca outra
   * conta.
   */
  if (!company) {
    const contratante = sessao.papel === "prestador_servico";

    return (
      <PageShell>
        <EmptyState
          icon={<Inbox size={22} />}
          title={
            contratante
              ? "Você ainda não publicou nenhuma vaga"
              : "Nenhuma empresa vinculada a esta conta"
          }
          description={
            contratante
              ? "Publique a primeira e seu perfil de contratante é criado junto — sem formulário nenhum, com os dados que você já cadastrou."
              : "Isto não devia acontecer: a conta de empresa ganha o perfil no cadastro. Fale com a gente que resolvemos no suporte."
          }
          action={
            contratante ? (
              <ButtonLink
                href={`${area.base}/vagas/nova`}
                variant="empresas"
                size="sm"
              >
                Publicar primeira vaga
              </ButtonLink>
            ) : undefined
          }
        />
      </PageShell>
    );
  }

  /*
   * A busca de candidatos só aparece para quem a matriz deixa entrar (#251).
   *
   * O painel é o mesmo para empresa e prestador (#189), e mostrava os dois
   * links para `/candidatos` aos dois — só que o prestador não tem
   * `candidato:buscar_disponiveis`, e o link dele dava 404. Link que
   * aparece e devolve erro é a armadilha que o AGENTS.md já registra.
   *
   * **Esconder, e não dar a permissão, é decisão de consentimento.** Quem
   * liga a opção lê "Quero que *empresas* me encontrem". O prestador
   * contrata como pessoa física; abrir a busca a ele ampliaria, sem aviso,
   * quem vê o contato de gente que pediu discrição. Se um dia a busca for
   * dele, o texto da caixa muda primeiro.
   *
   * Pela matriz e não pela área: se a capacidade chegar ao prestador, os
   * links voltam sozinhos, sem ninguém lembrar deste arquivo.
   */
  const buscaCandidatos = pode(sessao.papel, "candidato:buscar_disponiveis");

  /*
   * Quem respondeu o que a vaga exigia vem primeiro, e quem não, num grupo à
   * parte (#491). A ordem dentro de cada grupo é a que a lista já tinha.
   */
  const triagem = new Map(
    applications.map((a) => [
      a.id,
      motivosDeNaoAtender(a.job_questions ?? [], a.answers),
    ]),
  );
  const atendem = applications.filter((a) => triagem.get(a.id)?.length === 0);
  const naoAtendem = applications.filter(
    (a) => (triagem.get(a.id)?.length ?? 0) > 0,
  );

  const linhaDaCandidatura = (app: (typeof applications)[number]) => (
    <li
      key={app.id}
      /*
          Duas linhas no celular, uma no desktop (#252).

          Numa fileira só, avatar, %, WhatsApp e o seletor de
          estágio não encolhem — quem encolhia era o nome. Em
          360 px a empresa lia "E…", "W.", "P": não conseguia
          saber quem tinha se candidatado. A varredura de rolagem
          lateral passava verde, porque nada vazava; o `truncate`
          fazia exatamente o que promete.
        */
      className="flex flex-col gap-2 p-4 transition-colors hover:bg-panel-2 sm:flex-row sm:items-center sm:gap-3"
    >
      {/*
          A linha inteira abre a ficha: nome e vaga não
          bastam para decidir chamar alguém, e antes disto não
          havia para onde clicar.
        */}
      <Link
        href={`${area.base}/candidaturas/${app.id}`}
        className="group flex min-h-11 min-w-0 flex-1 items-center gap-3"
      >
        <Avatar
          name={app.candidate.full_name}
          src={app.candidate.avatar_url}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold underline-offset-2 group-hover:underline">
            {app.candidate.full_name}
          </p>
          <p className="truncate text-xs text-muted">
            {app.job_title}
            {` · ${timeAgo(app.created_at)}`}
          </p>
          {/*
              O motivo, à vista (#491): a empresa lê por que a pessoa
              está no grupo à parte, sem abrir a ficha.
            */}
          {(triagem.get(app.id)?.length ?? 0) > 0 && (
            <p className="truncate text-warn text-xs">
              Respondeu Não: {triagem.get(app.id)?.join(" · ")}
            </p>
          )}
        </div>
      </Link>

      {/*
          Recuo de `pl-12` no celular: alinha os controles com o
          texto, e não com o avatar, para a segunda linha ler como
          parte da mesma pessoa.
        */}
      <div className="flex items-center gap-2 pl-12 sm:pl-0">
        <SeloDeMatch match={match.get(app.id)} />

        {/*
          Atalho de contato na própria lista: o caminho entre
          receber o currículo e chamar a pessoa não deveria ter
          uma tela no meio.
        */}
        {app.candidate.phone && (
          <a
            href={whatsappLink(
              app.candidate.phone,
              mensagemParaCandidato({
                candidato: app.candidate.full_name,
                vaga: app.job_title,
                empresa: company.company_name,
              }),
            )}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Chamar ${app.candidate.full_name} no WhatsApp`}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-vagas hover:text-vagas"
          >
            <MessageCircle size={16} />
          </a>
        )}

        <MoverCandidaturaSelect id={app.id} statusAtual={app.status} />
      </div>
    </li>
  );

  return (
    <PageShell>
      {/*
        O título é o da área, não "Minha Empresa" fixo.
        
        O prestador chegava aqui pela porta dele e lia o nome da porta da
        empresa — que é exatamente o que a #189 veio desfazer. Foi o e2e
        que pegou: o painel renderizava certo e o cabeçalho mentia.
      */}
      <PageTitle
        title={area.nome}
        accent="text-empresas"
        description="Acompanhe suas vagas e os currículos recebidos."
        action={
          <div className="flex flex-wrap gap-2">
            {buscaCandidatos && (
              <ButtonLink href="/candidatos" variant="outline">
                <UserSearch size={17} />
                Candidatos
              </ButtonLink>
            )}
            <ButtonLink href={`${area.base}/vagas/nova`} variant="empresas">
              <Plus size={17} />
              Publicar nova vaga
            </ButtonLink>
          </div>
        }
      />

      <Panel>
        <div className="flex items-start gap-4">
          <Avatar
            name={company.company_name}
            src={company.logo_url}
            size="lg"
            square
          />
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-1.5 text-lg font-bold">
              {company.company_name}
              <VerifiedMark size={16} />
            </h2>
            <p className="mt-1 text-xs text-muted">
              CNPJ {company.cnpj ?? "não informado"}
            </p>
            {/*
              O selo lia `company.plan`, a coluna `perfis_empresa.plano`
              que nasceu no schema e **nunca teve quem a escrevesse** — a
              armadilha do estado declarado sem produtor, registrada no
              AGENTS.md. Presa em `trial` para todo mundo, ela fazia o
              painel prometer "1ª vaga gratuita" a quem paga desde a
              primeira, e continuaria dizendo isso a quem tivesse acabado
              de assinar o plano mensal.

              Quem responde de verdade é a carteira, que a página já
              carregou logo acima para o card de saldo.
            */}
            <div className="mt-2.5">
              <Badge tone={direito.mensalAtivo ? "empresas" : "outline"}>
                {direito.mensalAtivo
                  ? seloDoDireito(direito).texto
                  : "Pagamento por vaga"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat
            label="Vagas ativas"
            value={stats.active_jobs}
            accent="text-empresas"
          />
          <Stat label="Currículos" value={stats.applications} />
          <Stat
            label="Visualizações (30 dias)"
            value={totais.visualizacoes.toLocaleString("pt-BR")}
          />
        </div>

        <SerieGrafico serie={serie} />
      </Panel>

      {/*
        Dois atalhos que estavam escondidos.

        "Candidatos" existia só como um botão pequeno no cabeçalho, ao
        lado de "Publicar nova vaga" — e a busca inteira da #83 passava
        despercebida por quem não sabia que ela existia. Aqui os dois
        ganham espaço, e cada um diz o que a pessoa encontra do outro
        lado: atalho sem explicação é atalho que ninguém clica.
      */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href={`${area.base}/creditos`}
          className="rounded-[var(--radius-card)] border border-line bg-panel p-4 transition-colors hover:bg-panel-2"
        >
          <div className="flex items-center gap-2">
            <Ticket size={18} className="flex-none text-empresas" />
            <h2 className="font-bold text-sm">{resumoDoPlano.titulo}</h2>
          </div>
          <p className="mt-1 text-muted text-sm leading-relaxed">
            {resumoDoPlano.detalhe}
          </p>
        </Link>

        {/*
          Quem já se candidatou (#494): a lista que a empresa já formou, sem
          repetir. Ao abrir outra vaga parecida ela não começa do zero.
        */}
        <Link
          href={`${area.base}/talentos`}
          className="rounded-[var(--radius-card)] border border-line bg-panel p-4 transition-colors hover:bg-panel-2"
        >
          <div className="flex items-center gap-2">
            <Users size={18} className="flex-none text-empresas" />
            <h2 className="font-bold text-sm">Quem já se candidatou</h2>
          </div>
          <p className="mt-1 text-muted text-sm leading-relaxed">
            Todo mundo que se candidatou a alguma vaga sua, sem repetir — para
            começar a próxima com gente que já combina.
          </p>
        </Link>

        {buscaCandidatos && (
          <Link
            href="/candidatos"
            className="rounded-[var(--radius-card)] border border-line bg-panel p-4 transition-colors hover:bg-panel-2"
          >
            <div className="flex items-center gap-2">
              <UserSearch size={18} className="flex-none text-empresas" />
              <h2 className="font-bold text-sm">Buscar candidatos</h2>
            </div>
            <p className="mt-1 text-muted text-sm leading-relaxed">
              Procure por habilidade e área entre quem pediu para ser encontrado
              — sem esperar alguém se candidatar.
            </p>
          </Link>
        )}
      </div>

      {/* Vagas publicadas */}
      <section className="mt-6">
        <h2 className="text-base font-bold">Vagas publicadas</h2>
        {/*
          O que a visualização é, dito uma vez, antes dos números (#492): ela
          serve para comparar uma vaga com outra, e não para contar pessoas —
          quem recarrega a página conta de novo, porque a Lupa não guarda
          quem viu.
        */}
        <p className="mt-1 mb-3 text-faint text-xs leading-relaxed">
          Visualização serve para comparar uma vaga com outra, não para contar
          pessoas: quem abre de novo conta de novo. Muito compatível é quem
          combina com {LIMIAR_MUITO_COMPATIVEL}% ou mais do que a vaga pede.
        </p>
        {jobs.length === 0 ? (
          <EmptyState
            icon={<FileText size={22} />}
            title="Você ainda não publicou nenhuma vaga"
            description="Publicar leva menos de dois minutos, e usa uma vaga do seu saldo."
            action={
              <ButtonLink
                href={`${area.base}/vagas/nova`}
                variant="empresas"
                size="sm"
              >
                <Plus size={16} />
                Publicar vaga
              </ButtonLink>
            }
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel">
            {jobs.map((job) => {
              const expirada =
                job.status === "aberta" && vagaExpirada(job.expires_at);
              const resultado = resultados.get(job.id);
              return (
                <li
                  key={job.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4 transition-colors hover:bg-panel-2"
                >
                  <Link
                    href={`/vagas/${job.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      {/* Duas linhas, e não uma cortada: ao lado há o selo de
                          estado e o botão (#479). */}
                      <p className="line-clamp-2 text-sm font-semibold">
                        {job.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {pluralize(
                          job.applicant_count,
                          "candidato",
                          "candidatos",
                        )}{" "}
                        · {timeAgo(job.created_at)}
                        {job.status === "aberta" &&
                          ` · ${prazoDaVaga(job.expires_at)}`}
                      </p>
                    </div>
                    <Badge
                      tone={
                        expirada
                          ? "warn"
                          : job.status === "aberta"
                            ? "vagas"
                            : "neutral"
                      }
                    >
                      {expirada
                        ? "Expirada"
                        : job.status === "aberta"
                          ? "Ativa"
                          : "Encerrada"}
                    </Badge>
                  </Link>
                  {/*
                    O "Encerrar" devolve o botão e, ao ser tocado, um quadro de
                    confirmação que ocupa a linha inteira: por isso a linha é
                    `flex-wrap` e o botão é filho direto dela (#481).
                  */}
                  {job.status === "aberta" &&
                    (expirada ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <ReativarVagaButton id={job.id} />
                      </div>
                    ) : (
                      <EncerrarVagaButton id={job.id} titulo={job.title} />
                    ))}
                  {resultado && (
                    <div className="basis-full">
                      <ResultadoDaVagaLinha
                        resultado={resultado}
                        finalizada={job.status !== "aberta" || expirada}
                        vagaId={job.id}
                        base={area.base}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Recomendados vagas={recomendados} base={area.base} />

      {/* Currículos recebidos */}
      <section className="mt-8">
        <h2 className="mb-3 text-base font-bold">Currículos recebidos</h2>
        {applications.length === 0 ? (
          <EmptyState
            icon={<Inbox size={22} />}
            title="Nenhuma candidatura ainda"
            description="Assim que alguém se candidatar às suas vagas, o currículo aparece aqui."
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel">
            {atendem.map(linhaDaCandidatura)}
            {naoAtendem.length > 0 && (
              /*
                Quem não respondeu o que a vaga exigia aparece à parte, e não
                some (#491): a decisão de olhar continua sendo da empresa, e
                o motivo está escrito em cada linha.
              */
              <li className="bg-panel-2 px-4 py-2 font-semibold text-muted text-xs">
                Não responderam o que a vaga exigia ({naoAtendem.length})
              </li>
            )}
            {naoAtendem.map(linhaDaCandidatura)}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
