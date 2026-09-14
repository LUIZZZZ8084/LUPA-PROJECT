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

export function VerificationRow({
  phoneVerified,
  docVerified,
  className,
}: {
  phoneVerified: boolean;
  docVerified: boolean;
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
    {
      on: docVerified,
      icon: ShieldCheck,
      label: "Documento verificado",
      off: "Documento não verificado",
    },
  ];

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
