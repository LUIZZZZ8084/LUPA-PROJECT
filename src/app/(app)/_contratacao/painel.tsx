import {
  Building2,
  CalendarClock,
  Clock,
  Inbox,
  Plus,
  UserSearch,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
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
import { APPLICATION_LABELS, APPLICATION_TONE } from "@/lib/constants";
import {
  empresaDoPainel,
  getCompany,
  getCompanyApplications,
  getCompanyJobs,
  getCompanyStats,
} from "@/lib/data";
import { timeAgo } from "@/lib/format";
import {
  alcancePorEtapa,
  contarPorEstagio,
  vagasVencendo,
} from "@/lib/funil-de-candidaturas";
import { resumoDoDireito, seloDoDireito } from "@/lib/planos-empresa";
import type { Company } from "@/lib/types";
import { cn } from "@/lib/utils";
import { sessaoOuEntrar } from "@/server/auth/cookies";
import { pode } from "@/server/auth/rbac";
import { usuarioDaSessao } from "@/server/auth/servico";
import { matchPorCandidatura } from "@/server/candidaturas/match";
import { recomendadosParaEmpresa } from "@/server/candidaturas/recomendados";
import { direitoDePublicar } from "@/server/carteiras/servico";
import {
  serieDoPainel,
  temPainelDeEmpresa,
  totaisDaSerie,
} from "@/server/visualizacoes/servico";
import { AbasDaContratacao } from "./abas";
import { type AreaDeContratacao, areaDoPapel } from "./area";
import { ContadorDeVagas } from "./contador-de-vagas";
import { Recomendados } from "./recomendados";
import { SeloDeMatch } from "./selo-de-match";
import { SerieGrafico } from "./serie-grafico";
import { type PassoDoTutorial, TutorialDoPainel } from "./tutorial";

/** A empresa do admin enquanto ela não tem perfil gravado (#499). */
async function empresaDoAdmin(usuarioId: string): Promise<Company | null> {
  const usuario = await usuarioDaSessao(usuarioId);
  if (!usuario) return null;

  return {
    profile_id: usuario.id,
    company_name: usuario.nomeCompleto,
    cnpj: null,
    logo_url: null,
    plan: "trial",
    site: null,
    instagram: null,
    facebook: null,
  };
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
   * 404 e não 403, como no resto da casa. O admin passa por este portão
   * desde a #499: ele tem a empresa dele, e a visão geral continua sendo o
   * `/admin/painel`.
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
  const [empresaDoBanco, jobs, applications, stats, serie, recomendados] =
    await Promise.all([
      getCompany(companyId),
      getCompanyJobs(companyId),
      getCompanyApplications(companyId),
      getCompanyStats(companyId),
      // Quem não é empresa cai no estado vazio logo abaixo; pedir a série
      // antes disso trocaria a explicação por uma tela de erro.
      temPainelDeEmpresa(sessao) ? serieDoPainel(sessao) : [],
      recomendadosParaEmpresa(sessao),
    ]);
  const totais = totaisDaSerie(serie);
  const match = matchPorCandidatura(applications, jobs);
  const direito = await direitoDePublicar(sessao.usuarioId);
  const resumoDoPlano = resumoDoDireito(direito);

  /*
   * O admin abre o painel inteiro antes da primeira vaga (#499).
   *
   * A conta dele é criada por script, sem perfil de empresa, e o perfil
   * nasce na primeira vaga que ele publica. O estado vazio logo abaixo
   * esconde as abas, o resumo e o tutorial — e o pedido era justamente
   * olhar a área inteira. Nada é gravado aqui: é a
   * mesma empresa que a primeira vaga vai criar, montada com o nome da
   * conta.
   */
  const company =
    empresaDoBanco ??
    (sessao.papel === "admin" ? await empresaDoAdmin(sessao.usuarioId) : null);

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
    const contratante = sessao.papel !== "empresa";

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
   * O resumo do dia (#511): o que precisa de atenção, o funil em números e
   * as candidaturas mais recentes. As listas inteiras moram nas abas — as
   * vagas em "Vagas" e as candidaturas em "Funil" —, e o painel responde a
   * pergunta de quem abre o app de manhã: o que eu faço hoje?
   */
  /*
   * O tutorial de primeira visita (#513) diz uma vez o que os cards de
   * atalho diziam sempre. O primeiro passo usa o plano de quem olha: a
   * primeira vaga grátis, o saldo ou o plano cheio. A busca só entra para
   * quem a matriz deixa buscar, pela mesma razão do botão (#251).
   */
  const passosDoTutorial: PassoDoTutorial[] = [
    {
      titulo: "Publique uma vaga",
      texto: `Pelo botão "Publicar nova vaga", aqui em cima. ${resumoDoPlano.titulo}. ${resumoDoPlano.detalhe} O saldo e os planos ficam em "Ver planos", no cartão da empresa.`,
    },
    {
      titulo: "Acompanhe os candidatos",
      texto:
        "Na aba Candidatos, cada currículo recebido vira um card. Mude o estágio pelo seletor do card (no computador, dá para arrastar) e veja quem falta olhar, quem vai para entrevista e quem foi selecionado.",
    },
    {
      titulo: "Chame de novo quem já se candidatou",
      texto:
        "A aba Talentos reúne todo mundo que já se candidatou a alguma vaga sua, cada pessoa uma vez. Ao abrir uma vaga parecida, comece por lá.",
    },
    ...(buscaCandidatos
      ? [
          {
            titulo: "Procure quem quer ser encontrado",
            texto:
              'No botão "Buscar candidatos", aqui em cima, você busca por habilidade e área entre quem pediu para ser encontrado por empresas, sem esperar alguém se candidatar.',
          },
        ]
      : []),
  ];

  const contagem = contarPorEstagio(applications);
  const alcance = alcancePorEtapa(contagem);
  const vencendo = vagasVencendo(jobs);
  const recentes = applications.slice(0, 5);
  const fracao = (n: number) =>
    alcance.recebidas === 0 ? null : n / alcance.recebidas;

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
        description="O que precisa da sua atenção hoje, suas vagas e os currículos recebidos."
        action={
          <div className="flex flex-wrap gap-2">
            {buscaCandidatos && (
              <ButtonLink href="/candidatos" variant="outline">
                <UserSearch size={17} />
                Buscar candidatos
              </ButtonLink>
            )}
            <ButtonLink href={`${area.base}/vagas/nova`} variant="empresas">
              <Plus size={17} />
              Publicar nova vaga
            </ButtonLink>
          </div>
        }
      />
      <AbasDaContratacao area={area} />
      <TutorialDoPainel passos={passosDoTutorial} />

      {/*
        Quantas vagas ainda dá para publicar (#518), antes do resto: é o que
        decide se o "Publicar nova vaga" lá em cima vai dar certo.
      */}
      <ContadorDeVagas direito={direito} base={area.base} />

      {/*
        Para hoje: três números que viram um clique. Cada cartão leva ao
        lugar onde a coisa se resolve — o funil já aberto no estágio, ou a
        aba de vagas.
      */}
      {/*
        No computador (#525) o painel vira duas colunas: o que mede (hoje,
        números e funil) à esquerda, e o que pede ação (recomendados e
        currículos recebidos) à direita. Os invólucros são `contents` abaixo
        de `lg`: não existem como caixa no celular e no tablet.
      */}
      <div className="contents lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-x-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="contents lg:block">
          <section aria-labelledby="para-hoje" className="mb-6">
            <h2 id="para-hoje" className="mb-3 font-bold text-base">
              Para hoje
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <CartaoDoDia
                href={`${area.base}/funil?estagio=enviada`}
                icone={<Inbox size={18} aria-hidden />}
                valor={contagem.enviada}
                rotulo={
                  contagem.enviada === 1
                    ? "Nova para olhar"
                    : "Novas para olhar"
                }
                dica="Abrir a ficha marca como vista."
                destaque={contagem.enviada > 0}
              />
              <CartaoDoDia
                href={`${area.base}/funil?estagio=entrevista`}
                icone={<CalendarClock size={18} aria-hidden />}
                valor={contagem.entrevista}
                rotulo="Em entrevista"
                dica="Quem você chamou para conversar."
              />
              <CartaoDoDia
                href={`${area.base}/vagas`}
                icone={<Clock size={18} aria-hidden />}
                valor={vencendo.length}
                rotulo={
                  vencendo.length === 1
                    ? "Vaga vence em até 3 dias"
                    : "Vagas vencem em até 3 dias"
                }
                dica="Reative para continuar recebendo."
                destaque={vencendo.length > 0}
                alerta
              />
            </div>
          </section>

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
                {/*
              Planos é página à parte, fora das abas (#515): a porta dela
              no painel fica ao lado do selo que diz o plano.
            */}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3">
                  <Badge tone={direito.mensalAtivo ? "empresas" : "outline"}>
                    {direito.mensalAtivo
                      ? seloDoDireito(direito).texto
                      : "Pagamento por vaga"}
                  </Badge>
                  <Link
                    href={`${area.base}/creditos`}
                    className="inline-flex min-h-11 items-center text-empresas text-sm underline-offset-2 hover:underline"
                  >
                    Ver planos
                  </Link>
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
        O funil em números: de todas as candidaturas, quantas já foram
        olhadas, quantas chegaram à entrevista e quantas foram selecionadas.
        A porcentagem é sobre as recebidas, a mesma conta do funil do painel
        do admin (#471): "10% viraram entrevista" se lê sem conta.
      */}
          {alcance.recebidas > 0 && (
            <section aria-labelledby="funil-em-numeros" className="mt-6">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="funil-em-numeros" className="font-bold text-base">
                  Do currículo à contratação
                </h2>
                <Link
                  href={`${area.base}/funil`}
                  className="inline-flex min-h-11 items-center text-empresas text-sm underline-offset-2 hover:underline"
                >
                  Ver candidatos
                </Link>
              </div>
              <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    ["Recebidas", alcance.recebidas],
                    ["Olhadas", alcance.olhadas],
                    ["Entrevistas", alcance.entrevistas],
                    ["Selecionados", alcance.selecionados],
                  ] as const
                ).map(([rotulo, valor], i) => {
                  const f = fracao(valor);
                  return (
                    <li
                      key={rotulo}
                      className="rounded-[var(--radius-card)] border border-line bg-panel p-4"
                    >
                      <p className="text-muted text-xs">{rotulo}</p>
                      <p className="mt-1 font-bold text-2xl tabular-nums">
                        {valor.toLocaleString("pt-BR")}
                      </p>
                      {i > 0 && f !== null && (
                        <>
                          <div
                            aria-hidden
                            className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-3"
                          >
                            <div
                              className="h-full rounded-full bg-empresas"
                              style={{ width: `${Math.round(f * 100)}%` }}
                            />
                          </div>
                          <p className="mt-1 text-faint text-xs">
                            {Math.round(f * 100)}% das recebidas
                          </p>
                        </>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </div>

        <div className="contents lg:block">
          <Recomendados vagas={recomendados} base={area.base} />

          {/* Candidaturas recentes: as cinco últimas; o resto está no funil. */}
          <section aria-labelledby="recentes" className="mt-8">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="recentes" className="font-bold text-base">
                Currículos recebidos
              </h2>
              {applications.length > recentes.length && (
                <Link
                  href={`${area.base}/funil`}
                  className="inline-flex min-h-11 items-center text-empresas text-sm underline-offset-2 hover:underline"
                >
                  Ver todos os {applications.length} candidatos
                </Link>
              )}
            </div>
            {recentes.length === 0 ? (
              <EmptyState
                icon={<Inbox size={22} />}
                title="Nenhuma candidatura ainda"
                description="Assim que alguém se candidatar às suas vagas, o currículo aparece aqui."
              />
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel">
                {recentes.map((app) => (
                  <li key={app.id}>
                    {/*
                  A linha inteira abre a ficha: nome e vaga não bastam para
                  decidir chamar alguém. Mover de estágio é no funil.
                */}
                    {/*
                  Duas linhas no celular, uma no desktop (#252): os selos ao
                  lado apertavam o nome a "E…" em 360 px.
                */}
                    <Link
                      href={`${area.base}/candidaturas/${app.id}`}
                      className="group flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 p-4 transition-colors hover:bg-panel-2"
                    >
                      <Avatar
                        name={app.candidate.full_name}
                        src={app.candidate.avatar_url}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-sm underline-offset-2 group-hover:underline">
                          {app.candidate.full_name}
                        </p>
                        <p className="truncate text-muted text-xs">
                          {app.job_title} · {timeAgo(app.created_at)}
                        </p>
                      </div>
                      <span className="flex basis-full items-center gap-2 pl-11 sm:basis-auto sm:pl-0">
                        <SeloDeMatch match={match.get(app.id)} />
                        <Badge tone={APPLICATION_TONE[app.status]}>
                          {APPLICATION_LABELS[app.status]}
                        </Badge>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </PageShell>
  );
}

/**
 * Um número do dia que vira um clique. `destaque` pinta a borda quando há o
 * que fazer; zero fica neutro, porque zero novas é boa notícia, não alarme.
 */
function CartaoDoDia({
  href,
  icone,
  valor,
  rotulo,
  dica,
  destaque = false,
  alerta = false,
}: {
  href: string;
  icone: ReactNode;
  valor: number;
  rotulo: string;
  dica: string;
  destaque?: boolean;
  alerta?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-card)] border bg-panel p-4 transition-colors hover:bg-panel-2",
        destaque
          ? alerta
            ? "border-warn/60"
            : "border-empresas/50"
          : "border-line",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 flex-none items-center justify-center rounded-xl",
          destaque
            ? alerta
              ? "bg-warn/15 text-warn"
              : "bg-empresas/15 text-empresas"
            : "bg-panel-2 text-muted",
        )}
      >
        {icone}
      </span>
      <span className="min-w-0">
        <span className="block font-bold text-2xl tabular-nums leading-none">
          {valor}
        </span>
        <span className="mt-1 block font-semibold text-sm">{rotulo}</span>
        <span className="block text-faint text-xs">{dica}</span>
      </span>
    </Link>
  );
}
