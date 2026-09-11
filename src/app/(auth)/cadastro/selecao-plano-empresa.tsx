import { Check } from "lucide-react";
import { ComprarButton } from "@/app/(app)/_contratacao/comprar-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { formatPrecoBRL } from "@/lib/format";
import { OPCOES_DE_VAGA } from "@/lib/planos-empresa";
import { PRECO_CENTAVOS } from "@/server/pagamentos/planos";

/**
 * Último passo do cadastro de empresa (#184): escolher um plano pago ou
 * continuar sem comprar agora.
 *
 * As opções e os botões são os mesmos de `/empresa/creditos` — mesma
 * lista (`OPCOES_DE_VAGA`), mesmo `ComprarButton`, mesma action por trás
 * dele. O saldo atual não entra aqui, ao contrário daquela tela: quem
 * acabou de criar a conta tem zero, e "Você tem 0 vagas" não ajuda
 * ninguém a decidir — só a lista de opções importa neste momento.
 */

const BENEFICIOS_TRIAL = [
  "Perfil da empresa no ar",
  "Buscar entre quem pediu para ser encontrado",
  "Compre quando tiver a primeira vaga para publicar",
];

export function SelecaoDePlanoEmpresa() {
  const mensal = formatPrecoBRL(PRECO_CENTAVOS.empresa_mensal / 100);

  return (
    <div className="space-y-3">
      {OPCOES_DE_VAGA.map((opcao) => (
        <Panel
          key={opcao.tipo}
          className={
            opcao.destaque
              ? "border-empresas bg-empresas/[0.04] ring-1 ring-empresas/20"
              : undefined
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-base">{opcao.nome}</h2>
                {opcao.destaque && <Badge tone="empresas">Melhor preço</Badge>}
              </div>
              <p className="mt-0.5 text-muted text-sm">{opcao.paraQuem}</p>
            </div>
            <p className="flex-none font-bold text-empresas text-xl">
              {formatPrecoBRL(PRECO_CENTAVOS[opcao.tipo] / 100)}
            </p>
          </div>
          <ComprarButton
            tipo={opcao.tipo}
            rotulo={`Comprar ${opcao.nome.toLowerCase()}`}
            destaque={Boolean(opcao.destaque)}
          />
        </Panel>
      ))}

      <Panel className="border-empresas bg-empresas/[0.04] ring-1 ring-empresas/20">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-bold text-base">Vagas ilimitadas</h2>
              <Badge tone="empresas">Recomendado</Badge>
            </div>
            <p className="mt-0.5 text-muted text-sm">
              Para quem contrata todo mês e não quer ficar contando.
            </p>
          </div>
          <p className="flex-none font-bold text-empresas text-xl">
            {mensal}
            <span className="ml-1 font-normal text-muted text-sm">/mês</span>
          </p>
        </div>
        <ComprarButton
          tipo="empresa_mensal"
          rotulo="Assinar o plano mensal"
          destaque
        />
      </Panel>

      <Panel>
        <h2 className="font-semibold text-sm text-muted">
          Continuar sem comprar
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
          Continuar sem comprar agora
        </ButtonLink>
      </Panel>
    </div>
  );
}
