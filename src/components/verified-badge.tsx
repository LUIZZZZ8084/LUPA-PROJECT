import { BadgeCheck, Phone, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Selo de verificação.
 *
 * É o principal fator de confiança do produto — alguém vai deixar um
 * estranho entrar em casa por causa dele. Por isso aparece no card de busca
 * e no perfil, sempre com o mesmo desenho.
 */
export function VerifiedMark({
  size = 16,
  className,
  title = "Perfil verificado",
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <BadgeCheck
      size={size}
      role="img"
      aria-label={title}
      className={cn("flex-none text-vagas", className)}
    />
  );
}

/** Linha de selos detalhada, usada no perfil do prestador. */
/**
 * Existe alguma forma de verificar telefone hoje?
 *
 * Não. É a #120, presa a provedor pago de SMS. A constante existe para
 * que a volta seja uma linha, e para que o motivo fique escrito junto do
 * lugar que depende dele — em vez de alguém reencontrar o selo apagado
 * daqui a meses e não saber se foi decisão ou esquecimento.
 */
const VERIFICACAO_DE_TELEFONE_EXISTE = false;

/**
 * Quem tem verificação de documento no produto (#253).
 *
 * `doc_verificado` só vira `true` por três caminhos: o prestador ao ativar
 * o perfil (CPF válido e único, #133), a empresa que entra por CPF, e a
 * empresa que confere o CNPJ na Receita. **Nenhum é do candidato** — ele
 * dá um CPF no cadastro, e não existe tela, botão nem fluxo que mude o
 * selo dele.
 *
 * Sem esta lista, todo candidato — o papel mais numeroso do app — via
 * "Documento não verificado" para sempre, logo abaixo do nome. É a mesma
 * lição do selo de telefone logo acima: aviso de perfil incompleto que a
 * pessoa não tem como completar não informa, e ainda sugere que há algo
 * errado com a conta dela.
 *
 * Lista explícita, e não "todo papel menos candidato": papel novo nasce
 * sem selo até alguém decidir que ele tem verificação.
 */
const PAPEIS_COM_VERIFICACAO_DE_DOCUMENTO: readonly string[] = [
  "prestador_servico",
  "empresa",
];

export function temVerificacaoDeDocumento(papel: string): boolean {
  return PAPEIS_COM_VERIFICACAO_DE_DOCUMENTO.includes(papel);
}

export function VerificationRow({
  phoneVerified,
  docVerified,
  mostrarDocumento = true,
  className,
}: {
  phoneVerified: boolean;
  docVerified: boolean;
  /** Falso para quem não tem verificação de documento — ver acima. */
  mostrarDocumento?: boolean;
  className?: string;
}) {
  const items = [
    /*
     * O telefone só entra quando houver como verificá-lo (#209).
     *
     * `telefone_verificado` é lido em dois lugares e **nada no código
     * escreve `true`** — verificação por SMS é a #120, parada por depender
     * de provedor pago. Enquanto isso, o selo dizia "Telefone não
     * verificado" para todo mundo, para sempre, sem nenhum caminho para
     * mudar isso: um aviso de perfil incompleto que a pessoa não tem como
     * completar.
     *
     * É a mesma degradação que o app já faz com Storage e com push: o que
     * não existe não aparece, em vez de aparecer quebrado. Quando a #120
     * entregar o envio, esta condição cai e o selo volta inteiro.
     */
    ...(VERIFICACAO_DE_TELEFONE_EXISTE
      ? [
          {
            on: phoneVerified,
            icon: Phone,
            label: "Telefone verificado",
            off: "Telefone não verificado",
          },
        ]
      : []),
    ...(mostrarDocumento
      ? [
          {
            on: docVerified,
            icon: ShieldCheck,
            label: "Documento verificado",
            off: "Documento não verificado",
          },
        ]
      : []),
  ];

  // Sem selo nenhum, sem linha: uma `div` vazia ainda carregaria a margem
  // de quem a posicionou.
  if (items.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map(({ on, icon: Icon, label, off }) => (
        <span
          key={label}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
            on ? "bg-vagas/12 text-vagas" : "bg-panel-3 text-faint",
          )}
        >
          <Icon size={13} />
          {on ? label : off}
        </span>
      ))}
    </div>
  );
}
