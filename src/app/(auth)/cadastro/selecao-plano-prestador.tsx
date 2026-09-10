import { Check, Sparkles } from "lucide-react";
import { AssinarButton } from "@/app/(app)/perfil/assinatura/assinar-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { formatPrecoBRL } from "@/lib/format";
import { DIAS_TESTE_GRATIS, PRECO_CENTAVOS } from "@/server/pagamentos/planos";

/**
 * Último passo do cadastro de prestador (#184): escolher entre continuar
 * sem assinar e assinar agora.
 *
 * Reaproveita `AssinarButton`, o mesmo componente de `/perfil/assinatura`
 * — o clique cai na mesma action (`assinarMensalidade`), que já sabe
 * redirecionar para o Checkout Pro ou, em demonstração, aprovar na hora.
 * Não existe uma segunda cópia da regra de cobrança aqui, só uma tela
 * nova para chegar nela mais cedo.
 */

const BENEFICIOS_PAGO = [
  "Aparece na busca de quem procura profissional",
  `${DIAS_TESTE_GRATIS} dias grátis antes da primeira cobrança`,
  "Cancele quando quiser, sem multa",
];

const BENEFICIOS_TRIAL = [
  "Perfil criado e pronto para editar",
  "Publique trabalhos feitos no seu feed",
  "Assine quando quiser para aparecer na busca",
];

export function SelecaoDePlanoPrestador() {
  const preco = formatPrecoBRL(PRECO_CENTAVOS.prestador_mensalidade / 100);

  return (
    <div className="space-y-4">
      <Panel className="border-servicos bg-servicos/[0.04] ring-1 ring-servicos/20">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-servicos" />
          <h2 className="font-bold text-base">Assinar agora</h2>
          <Badge tone="servicos">Recomendado</Badge>
        </div>
        <p className="mt-2 font-bold text-2xl text-servicos">
          {preco}
          <span className="ml-1 font-normal text-muted text-sm">/mês</span>
        </p>
        <ul className="mt-3 space-y-1.5 text-muted text-sm">
          {BENEFICIOS_PAGO.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <Check size={15} className="mt-0.5 flex-none text-servicos" />
              {b}
            </li>
          ))}
        </ul>
        <AssinarButton rotulo={`Testar ${DIAS_TESTE_GRATIS} dias grátis`} />
      </Panel>

      <Panel>
        <h2 className="font-semibold text-sm text-muted">
          Continuar sem assinar
        </h2>
        <p className="mt-2 font-bold text-xl">Grátis</p>
        <ul className="mt-3 space-y-1.5 text-muted text-sm">
          {BENEFICIOS_TRIAL.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <Check size={15} className="mt-0.5 flex-none text-faint" />
              {b}
            </li>
          ))}
        </ul>
        <ButtonLink href="/" variant="outline" size="sm" className="mt-4">
          Continuar sem assinar
        </ButtonLink>
      </Panel>
    </div>
  );
}
