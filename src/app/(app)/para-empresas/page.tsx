import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarClock,
  Columns3,
  EyeOff,
  ListChecks,
  MessageCircle,
  Search,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { formatPrecoBRL } from "@/lib/format";
import { OPCAO_AVULSA, PLANOS_DE_VAGA } from "@/lib/planos-empresa";
import { cn } from "@/lib/utils";
import { sessaoAtual } from "@/server/auth/cookies";
import { pode } from "@/server/auth/rbac";
import {
  PRECO_CENTAVOS,
  VAGAS_NO_AR_POR_PLANO,
} from "@/server/pagamentos/planos";
import type { TipoPagamento } from "@/server/pagamentos/tipos";

const DESCRICAO =
  "Publique vagas, receba candidatos da sua região e organize tudo num funil, com triagem e chamado no WhatsApp. Primeira vaga grátis para empresa com CNPJ conferido.";

export const metadata: Metadata = {
  title: "Lupa para empresas e agências",
  description: DESCRICAO,
  openGraph: { title: "Lupa para empresas e agências", description: DESCRICAO },
};

/**
 * A porta comercial da Lupa (#537).
 *
 * **Aberta sem sessão**, como a home e a vaga (#241, #490): o app é fechado
 * por login, e a empresa que recebia o link numa abordagem caía em "Entrar"
 * sem nunca ver o que o produto faz por ela. Esta página é o link que se
 * manda para a agência.
 *
 * **Não lê dado nenhum de ninguém.** Nada de contagem de contas, de vaga ou
 * de cidade: número que aparece aqui viraria afirmação comercial, e a
 * contagem por cidade já tem lugar certo, na tela de planos, para quem tem
 * conta (#489). O que a página mostra é o produto e o preço.
 *
 * **O preço vem de `PRECO_CENTAVOS`**, nunca escrito à mão — a chamada para
 * empresas da home já mentiu uma vez sobre a primeira vaga grátis, e há teste
 * que confere esta página contra a tabela.
 *
 * **Cada recurso listado existe hoje.** Promessa na tela é contrato: a vaga
 * confidencial (#538) e as anotações com entrevista marcada (#539) entraram
 * aqui no mesmo PR que as entregou, e não antes.
 */
export default async function ParaEmpresasPage() {
  const sessao = await sessaoAtual();
  const contrata = Boolean(sessao && pode(sessao.papel, "vaga:publicar"));

  return (
    <PageShell width="wide">
      <section className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-center lg:gap-12">
        <div>
          <p className="font-semibold text-empresas text-sm">
            Para empresas e agências de emprego
          </p>
          <h1 className="mt-2 text-balance font-bold text-3xl leading-tight tracking-tight sm:text-4xl">
            Contrate gente da sua região, sem planilha e sem grupo de WhatsApp
          </h1>
          <p className="mt-4 max-w-xl text-muted leading-relaxed">
            Publique a vaga, divulgue com um link que já sai com prévia, e
            receba os candidatos organizados num funil: quem combina com o que a
            vaga pede aparece primeiro, e o chamado no WhatsApp vai com a
            mensagem pronta.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {contrata ? (
              <ButtonLink href="/empresa" variant="empresas" size="lg">
                Ir para o painel
                <ArrowRight size={16} />
              </ButtonLink>
            ) : (
              <>
                <ButtonLink
                  href="/cadastro?tipo=empresa"
                  variant="empresas"
                  size="lg"
                >
                  Criar conta de empresa
                  <ArrowRight size={16} />
                </ButtonLink>
                {!sessao && (
                  <ButtonLink
                    href="/entrar?destino=/empresa"
                    variant="outline"
                    size="lg"
                  >
                    Já tenho conta
                  </ButtonLink>
                )}
              </>
            )}
          </div>
          <p className="mt-3 text-faint text-xs">
            A primeira vaga é grátis para empresa com CNPJ conferido na Receita.
          </p>
        </div>

        <ol className="mt-8 space-y-3 lg:mt-0" aria-label="Como funciona">
          {PASSOS.map((passo, i) => (
            <li key={passo.titulo}>
              <Panel className="flex items-start gap-4">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-empresas/15 font-bold text-empresas text-sm">
                  {i + 1}
                </span>
                <span>
                  <span className="block font-semibold text-sm">
                    {passo.titulo}
                  </span>
                  <span className="mt-0.5 block text-muted text-sm leading-snug">
                    {passo.texto}
                  </span>
                </span>
              </Panel>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14" aria-labelledby="recursos">
        <h2 id="recursos" className="font-bold text-2xl tracking-tight">
          O que a sua empresa recebe
        </h2>
        <p className="mt-1 text-muted text-sm">
          Tudo no mesmo painel, no celular ou no computador.
        </p>
        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map((r) => (
            <li key={r.titulo}>
              <Panel className="h-full">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-empresas/12 text-empresas">
                  {r.icone}
                </span>
                <h3 className="mt-3 font-semibold">{r.titulo}</h3>
                <p className="mt-1 text-muted text-sm leading-relaxed">
                  {r.texto}
                </p>
              </Panel>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14" aria-labelledby="precos">
        <h2 id="precos" className="font-bold text-2xl tracking-tight">
          Preços
        </h2>
        <p className="mt-1 text-muted text-sm">
          Cada vaga fica 30 dias no ar. Os planos limitam quantas vagas ficam no
          ar ao mesmo tempo, renovam todo mês e se cancelam quando quiser.
        </p>
        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[OPCAO_AVULSA, ...PLANOS_DE_VAGA].map((opcao) => {
            const avulsa = opcao.tipo === OPCAO_AVULSA.tipo;
            const porVaga = precoPorVaga(opcao.tipo);
            return (
              <li key={opcao.tipo}>
                <Panel
                  className={cn(
                    "h-full",
                    opcao.destaque && "border-empresas/40",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{opcao.nome}</h3>
                    {avulsa && <Badge tone="outline">Compra única</Badge>}
                    {opcao.destaque && (
                      <Badge tone="empresas">Mais completo</Badge>
                    )}
                  </div>
                  <p
                    className="mt-3 font-bold text-2xl text-empresas"
                    data-preco={opcao.tipo}
                  >
                    {preco(opcao.tipo)}
                  </p>
                  <p className="text-faint text-xs">
                    {avulsa
                      ? "pagamento único"
                      : porVaga
                        ? `por mês · ${porVaga} por vaga`
                        : "por mês"}
                  </p>
                  <p className="mt-3 text-muted text-sm">
                    {avulsa
                      ? "Uma vaga, 30 dias no ar."
                      : quantasVagas(opcao.tipo)}
                  </p>
                  <p className="mt-1 text-muted text-sm">{opcao.paraQuem}</p>
                </Panel>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-14" aria-labelledby="duvidas">
        <h2 id="duvidas" className="font-bold text-2xl tracking-tight">
          Dúvidas comuns
        </h2>
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Duvida titulo="Sou uma agência de emprego. Serve para mim?">
            Serve. O plano ilimitado deixa quantas vagas quiser no ar, o funil
            separa os candidatos de cada vaga e “Quem já se candidatou” reúne
            todo mundo que já passou por você, com filtro por habilidade, para a
            próxima vaga parecida. E a vaga pode ser confidencial: o cliente
            aparece descrito, sem o nome.
          </Duvida>
          <Duvida titulo="Preciso ter CNPJ?">
            Não para publicar: dá para contratar com CPF. O CNPJ conferido na
            Receita libera a primeira vaga grátis e a busca entre quem pediu
            para ser encontrado.
          </Duvida>
          <Duvida titulo="Quem vê o telefone dos candidatos?">
            Só a empresa da vaga a que a pessoa se candidatou, ou, na busca, a
            empresa conferida, e só de quem pediu para ser encontrado. Ninguém
            sem conta vê contato nenhum.
          </Duvida>
          <Duvida titulo="Posso editar a vaga depois?">
            Ainda não. Antes de publicar, você confere tudo numa tela de
            revisão. Se a vaga já foi preenchida, encerre: o lugar dela no plano
            volta na hora.
          </Duvida>
        </div>
        <p className="mt-4 text-muted text-sm">
          Ficou alguma dúvida?{" "}
          <Link href="/suporte" className="underline">
            Fale com a gente
          </Link>
          .
        </p>
      </section>

      {!contrata && (
        <Panel className="mt-14 border-empresas/25 bg-gradient-to-br from-empresas/8 to-transparent">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <h2 className="font-bold text-empresas text-lg">
                Publique a primeira vaga hoje
              </h2>
              <p className="mt-1 max-w-md text-muted text-sm">
                A conta leva poucos minutos. Com o CNPJ conferido, a primeira
                vaga é por nossa conta.
              </p>
            </div>
            <ButtonLink href="/cadastro?tipo=empresa" variant="empresas">
              Criar conta de empresa
              <ArrowRight size={16} />
            </ButtonLink>
          </div>
        </Panel>
      )}
    </PageShell>
  );
}

const PASSOS = [
  {
    titulo: "Crie a conta da empresa",
    texto: "Com CNPJ, conferimos na Receita na hora. Também dá com CPF.",
  },
  {
    titulo: "Publique a vaga",
    texto:
      "Salário, endereço, o que a vaga pede e até três perguntas de triagem.",
  },
  {
    titulo: "Divulgue",
    texto:
      "Mande o link no WhatsApp ou poste a arte pronta no story do Instagram.",
  },
  {
    titulo: "Receba e organize",
    texto: "Cada candidatura entra no funil, com currículo e contato.",
  },
] as const;

const RECURSOS: readonly {
  titulo: string;
  texto: string;
  icone: ReactNode;
}[] = [
  {
    titulo: "Funil de candidatos",
    texto:
      "As candidaturas em colunas, de recebida a selecionada. No computador, arraste o card; no celular, troque o estágio num toque.",
    icone: <Columns3 size={20} aria-hidden />,
  },
  {
    titulo: "Anotações e entrevista",
    texto:
      "Anote o que conversou, etiquete quem guardar para a próxima e marque a entrevista: ela aparece no painel e o convite vai pronto no WhatsApp.",
    icone: <CalendarClock size={20} aria-hidden />,
  },
  {
    titulo: "Perguntas de triagem",
    texto:
      "Até três perguntas de sim ou não. Quem respondeu o que a vaga exige vem primeiro, e ninguém é escondido.",
    icone: <ListChecks size={20} aria-hidden />,
  },
  {
    titulo: "Quem combina com a vaga",
    texto:
      "A % de casamento entre as habilidades da pessoa e o que a vaga pede, dizendo quais casaram.",
    icone: <Sparkles size={20} aria-hidden />,
  },
  {
    titulo: "Chamado no WhatsApp",
    texto:
      "Um toque abre a conversa com a mensagem pronta, com o nome da pessoa, o cargo e a sua empresa.",
    icone: <MessageCircle size={20} aria-hidden />,
  },
  {
    titulo: "Divulgação pronta",
    texto:
      "O link da vaga abre sem login e sai com prévia no WhatsApp e no Facebook, e há uma arte vertical para o story.",
    icone: <Share2 size={20} aria-hidden />,
  },
  {
    titulo: "Resultado de cada vaga",
    texto:
      "Visualizações, candidaturas e quantas combinam com a vaga, além do resumo do dia no painel.",
    icone: <BarChart3 size={20} aria-hidden />,
  },
  {
    titulo: "Seu banco de talentos",
    texto:
      "Todo mundo que já se candidatou a alguma vaga sua, sem repetir, com filtro por habilidade e área.",
    icone: <Users size={20} aria-hidden />,
  },
  {
    titulo: "Busca de candidatos",
    texto:
      "Empresa com CNPJ conferido procura também entre quem pediu para ser encontrado.",
    icone: <Search size={20} aria-hidden />,
  },
  {
    titulo: "Vaga confidencial",
    texto:
      "Para agências: descreva o cliente sem dizer o nome. A vaga aparece como confidencial, via a sua empresa, que recebe as candidaturas.",
    icone: <EyeOff size={20} aria-hidden />,
  },
  {
    titulo: "Candidatos de verdade",
    texto:
      "Cada CPF vale uma conta só, e a sua vaga aparece primeiro para quem mora mais perto dela.",
    icone: <BadgeCheck size={20} aria-hidden />,
  },
];

function preco(tipo: TipoPagamento): string {
  return formatPrecoBRL(PRECO_CENTAVOS[tipo] / 100);
}

function precoPorVaga(tipo: TipoPagamento): string | null {
  const limite = VAGAS_NO_AR_POR_PLANO[tipo];
  if (!limite) return null;
  return formatPrecoBRL(PRECO_CENTAVOS[tipo] / 100 / limite);
}

function quantasVagas(tipo: TipoPagamento): string {
  const limite = VAGAS_NO_AR_POR_PLANO[tipo];
  return limite == null
    ? "Vagas ilimitadas no ar."
    : `Até ${limite} vagas no ar ao mesmo tempo.`;
}

function Duvida({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Panel>
      <h3 className="font-semibold">{titulo}</h3>
      <p className="mt-1 text-muted text-sm leading-relaxed">{children}</p>
    </Panel>
  );
}
