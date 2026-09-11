import {
  Briefcase,
  Building2,
  CreditCard,
  FileDown,
  FileText,
  LogIn,
  Pencil,
  ShieldCheck,
  Ticket,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import {
  PerfilCandidato,
  PerfilEmpresa,
  PerfilPrestador,
} from "@/components/perfil-profissional";
import { SairButton } from "@/components/sair-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { VerificationRow } from "@/components/verified-badge";
import { ROLE_LABELS } from "@/lib/constants";
import { getProviderById } from "@/lib/data";
import { formatPhone } from "@/lib/format";
import { sessaoAtual } from "@/server/auth/cookies";
import type { Capacidade } from "@/server/auth/rbac";
import { pode } from "@/server/auth/rbac";
import { usuarioDaSessao } from "@/server/auth/servico";
import { direitoDePublicar } from "@/server/carteiras/servico";
import { perfilParaEditar } from "@/server/perfil/servico";
import { VerificarCnpj } from "./verificar-cnpj";

export const metadata: Metadata = {
  title: "Perfil",
};

/**
 * Os atalhos aparecem conforme a capacidade do papel.
 *
 * Mostrar um link que devolve "sem permissão" ao ser clicado é pior do que
 * não mostrar: a pessoa conclui que o app está quebrado.
 */
const ATALHOS: {
  href: string;
  icon: typeof Briefcase;
  titulo: string;
  descricao: string;
  cor: string;
  exige: Capacidade;
  /**
   * Papéis para os quais o atalho **não** aparece, mesmo tendo a
   * capacidade (#191).
   *
   * A capacidade responde "pode?", e às vezes a resposta certa para a
   * tela é outra: o prestador *pode* ver as próprias candidaturas — e a
   * rota continua respondendo —, mas o card abria numa tela vazia para
   * sempre para quem se cadastrou direto como prestador. Tirar a
   * capacidade faria `/perfil/candidaturas` dar 404, que é o dano que o
   * AGENTS.md registra; o que sai é o atalho, não o acesso.
   */
  escondeDe?: readonly string[];
}[] = [
  {
    href: "/perfil/candidaturas",
    icon: Briefcase,
    titulo: "Minhas candidaturas",
    descricao: "Acompanhe o status das vagas em que você se candidatou.",
    cor: "text-vagas",
    exige: "candidatura:ver_propria",
    escondeDe: ["prestador_servico"],
  },
  {
    href: "/empresa",
    icon: Building2,
    titulo: "Minha Empresa",
    descricao: "Vagas publicadas, currículos recebidos e plano.",
    cor: "text-empresas",
    exige: "vaga:publicar",
    escondeDe: ["prestador_servico"],
  },
  /*
   * A mesma coisa, na porta do prestador (#189).
   *
   * Não é um segundo painel: as duas rotas renderizam a mesma
   * implementação, em `_contratacao/`. O que muda é o nome — quem
   * contrata um ajudante não se reconhece em "Minha Empresa".
   */
  {
    href: "/contratar",
    icon: Building2,
    titulo: "Contratar",
    descricao: "Publique vagas e receba currículos, sem precisar de CNPJ.",
    cor: "text-empresas",
    exige: "vaga:publicar",
    escondeDe: ["empresa", "admin"],
  },
  {
    href: "/perfil/assinatura",
    icon: CreditCard,
    titulo: "Assinatura",
    descricao: "Mensalidade para aparecer na busca de profissionais.",
    cor: "text-servicos",
    exige: "prestador:gerenciar_assinatura",
  },
  /*
   * O caminho da empresa para a cobrança, que não existia (#182).
   *
   * A tela de compra vive em `/empresa/creditos` desde a #172, e só se
   * chegava nela pelo painel. Quem se cadastrava como empresa abria o
   * perfil, não via nada sobre pagar, e descobria ao ser barrado na hora
   * de publicar — botão que falta é mais silencioso que botão que recusa,
   * e este arquivo já registra as duas armadilhas.
   *
   * O gate é `vaga:publicar`, então o prestador que contrata também o vê:
   * ele tem a capacidade desde a #129 e compra vaga do mesmo jeito. Para
   * ele são duas cobranças diferentes, e os títulos dizem qual é qual —
   * "Assinatura" é a mensalidade que o põe na vitrine, "Comprar vagas" é
   * o que ele gasta para contratar alguém.
   */
  {
    href: "/empresa/creditos",
    icon: Ticket,
    titulo: "Comprar vagas",
    descricao: "Saldo para publicar, ou plano mensal ilimitado.",
    cor: "text-empresas",
    exige: "vaga:publicar",
    escondeDe: ["prestador_servico"],
  },
  {
    href: "/contratar/creditos",
    icon: Ticket,
    titulo: "Comprar vagas",
    descricao: "Saldo para publicar, ou plano mensal ilimitado.",
    cor: "text-empresas",
    exige: "vaga:publicar",
    escondeDe: ["empresa", "admin"],
  },
  {
    href: "/perfil/curriculo",
    icon: FileDown,
    titulo: "Gerador de currículo",
    descricao: "Gere e baixe seu currículo em PDF, pronto para anexar.",
    cor: "text-vagas",
    exige: "candidato:gerar_curriculo",
  },
  {
    href: "/admin",
    icon: ShieldCheck,
    titulo: "Painel de verificações",
    descricao: "Aprovar documentos enviados.",
    cor: "text-warn",
    exige: "admin:decidir_verificacao",
  },
];

export default async function PerfilPage() {
  const sessao = await sessaoAtual();
  const usuario = sessao ? await usuarioDaSessao(sessao.usuarioId) : null;

  const atalhos = sessao
    ? ATALHOS.filter(
        (a) =>
          pode(sessao.papel, a.exige) && !a.escondeDe?.includes(sessao.papel),
      )
    : [];

  /*
   * A identidade profissional vem de tabelas diferentes por papel. Buscar
   * só a do papel de quem entrou evita três consultas para mostrar uma.
   */
  /*
   * O perfil vem do serviço, não da camada de dados pública.
   *
   * `src/lib/data.ts` lê o que é público e, em demonstração, não alcança o
   * currículo — que fica fora de qualquer view por decisão de privacidade.
   * Resultado: a pessoa salvava e a tela continuava dizendo que estava
   * vazio. O serviço fala com o repositório, que é o mesmo caminho onde a
   * edição grava, e funciona nos dois modos.
   */
  const perfil = sessao
    ? await perfilParaEditar(sessao.usuarioId, sessao.papel)
    : null;

  /*
   * O que a empresa pode publicar hoje, para o selo dizer a verdade.
   *
   * Só é buscado para quem contrata: pedir a carteira de um candidato
   * seria uma consulta a mais para responder o que já se sabe.
   */
  const direito =
    sessao && pode(sessao.papel, "vaga:publicar")
      ? await direitoDePublicar(sessao.usuarioId)
      : null;

  /*
   * A nota vem à parte, da listagem pública: ela é calculada por trigger e
   * não é campo do perfil. Nula significa "ainda não avaliado".
   */
  const listagem =
    sessao?.papel === "prestador_servico"
      ? await getProviderById(sessao.usuarioId)
      : null;

  return (
    <PageShell width="narrow">
      <PageTitle
        title="Perfil"
        description="Sua conta e seus atalhos na Lupa."
        action={
          usuario ? (
            <ButtonLink href="/perfil/editar" variant="outline" size="sm">
              <Pencil size={15} />
              Editar perfil
            </ButtonLink>
          ) : undefined
        }
      />

      {usuario ? (
        <Panel className="mb-5">
          <div className="flex items-start gap-4">
            <Avatar
              name={usuario.nomeCompleto}
              src={usuario.avatarUrl}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-bold">
                {usuario.nomeCompleto}
              </h2>
              <p className="mt-0.5 truncate text-xs text-muted">
                {usuario.email}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {formatPhone(usuario.telefone)}
                {usuario.bairro ? ` · ${usuario.bairro}` : ""} ·{" "}
                {usuario.cidade}
              </p>
              <div className="mt-2.5">
                <Badge tone="neutral">
                  {sessao && sessao.papel === "admin"
                    ? "Administrador"
                    : ROLE_LABELS[usuario.papel as keyof typeof ROLE_LABELS]}
                </Badge>
              </div>
            </div>
          </div>

          <VerificationRow
            className="mt-5"
            phoneVerified={usuario.telefoneVerificado}
            docVerified={usuario.docVerificado}
          />

          <div className="mt-5 border-t border-line pt-4">
            <SairButton />
          </div>
        </Panel>
      ) : (
        <Panel className="mb-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-panel-2 text-muted">
            <UserRound size={24} />
          </div>
          <h2 className="mt-4 font-bold">Você ainda não entrou</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
            Entre para se candidatar a vagas, gerenciar seu perfil de prestador
            ou publicar vagas pela sua empresa.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/entrar" variant="vagas" size="sm">
              <LogIn size={15} />
              Entrar
            </ButtonLink>
            <ButtonLink href="/cadastro" variant="outline" size="sm">
              Criar conta
            </ButtonLink>
          </div>
        </Panel>
      )}

      {sessao?.papel === "candidato_clt" && (
        <PerfilCandidato perfil={perfil?.candidato ?? null} />
      )}
      {sessao?.papel === "prestador_servico" && (
        <PerfilPrestador
          perfil={perfil?.prestador ?? null}
          listagem={listagem}
          docVerificado={Boolean(usuario?.docVerificado)}
        />
      )}
      {sessao?.papel === "empresa" && (
        <PerfilEmpresa
          empresa={perfil?.empresa ?? null}
          docVerificado={Boolean(usuario?.docVerificado)}
          direito={direito}
          verificarCnpj={<VerificarCnpj />}
        />
      )}

      {atalhos.length > 0 && (
        <div className="space-y-2.5">
          {atalhos.map(({ href, icon: Icon, titulo, descricao, cor }) => (
            <Link
              key={href}
              href={href}
              className="flex items-start gap-3.5 rounded-[var(--radius-card)] border border-line bg-panel p-4 transition-colors hover:bg-panel-2"
            >
              <Icon size={20} className={`mt-0.5 flex-none ${cor}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{titulo}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                  {descricao}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}

      <Panel className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <FileText size={16} className="text-muted" />
          Seus dados e a LGPD
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          CPF e CNPJ são conferidos automaticamente contra a Receita Federal,
          sem que você precise enviar documento ou selfie — nenhum dos dois fica
          guardado em lugar nenhum. Permanece só a confirmação, no seu perfil.
        </p>
      </Panel>
    </PageShell>
  );
}
