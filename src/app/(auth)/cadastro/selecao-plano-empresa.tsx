import { ArrowRight, Check, CheckCircle2 } from "lucide-react";
import { ComprarButton } from "@/app/(app)/_contratacao/comprar-button";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { formatPrecoBRL } from "@/lib/format";
import { OPCOES_DE_VAGA } from "@/lib/planos-empresa";
import { PRECO_CENTAVOS } from "@/server/pagamentos/planos";

/**
 * Último passo do cadastro de empresa: a conta já existe, e comprar é
 * opcional.
 *
 * Nasceu na #184 com as quatro opções pagas em cima e o grátis por último,
 * discreto. Quem acabava de se cadastrar lia aquilo como "o app já está me
 * cobrando para usar" — o "Conta criada" ficava pequeno perto de uma lista
 * de preços, e a saída grátis só aparecia depois de rolar (#299).
 *
 * Por isso a ordem inverteu: primeiro a confirmação dizendo que nada foi
 * cobrado, depois o grátis em destaque, e as compras por último, como
 * linhas compactas e marcadas como opcionais. A tela inteira cabe num
 * celular comum sem rolar — o que fica abaixo da dobra é o que a pessoa
 * não vê, e aqui o que ela não via era justamente a opção grátis.
 *
 * As opções e os botões continuam os mesmos de `/empresa/creditos` — mesma
 * lista (`OPCOES_DE_VAGA`), mesmo `ComprarButton`, mesma action. O saldo
 * não entra: quem acabou de criar a conta tem zero.
 */

const BENEFICIOS_GRATIS = [
  "Perfil da empresa no ar",
  "Buscar entre quem pediu para ser encontrado",
  "Pague só quando tiver vaga para publicar",
];

export function SelecaoDePlanoEmpresa() {
  const mensal = formatPrecoBRL(PRECO_CENTAVOS.empresa_mensal / 100);

  return (
    <div className="space-y-4">
      <div
        role="status"
        className="flex items-start gap-3 rounded-[var(--radius-panel)] border border-line bg-panel p-4"
      >
        <CheckCircle2 size={28} className="flex-none text-vagas" aria-hidden />
        <div className="min-w-0">
          <h2 className="font-bold text-lg leading-tight">Conta criada</h2>
          <p className="mt-1 text-muted text-sm leading-relaxed">
            Sua empresa já está na Lupa.{" "}
            <strong className="font-semibold text-ink">
              Nada foi cobrado.
            </strong>{" "}
            Comprar vaga é opcional e pode ficar para depois.
          </p>
        </div>
      </div>

      <Panel className="border-empresas p-4 ring-1 ring-empresas/20 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-bold text-base">Começar grátis</h3>
          <p className="flex-none font-bold text-empresas text-xl">R$ 0</p>
        </div>
        <ul className="mt-2 space-y-1 text-muted text-sm">
          {BENEFICIOS_GRATIS.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <Check size={15} className="mt-0.5 flex-none text-empresas" />
              {b}
            </li>
          ))}
        </ul>
        <ButtonLink
          href="/empresa"
          variant="empresas"
          size="sm"
          className="mt-3 w-full"
        >
          Continuar grátis
          <ArrowRight size={15} />
        </ButtonLink>
      </Panel>

      <section aria-labelledby="comprar-depois">
        <h3 id="comprar-depois" className="font-semibold text-sm">
          Quando tiver vaga para publicar
        </h3>
        <p className="mt-0.5 text-muted text-xs">
          Opcional. Dá para comprar depois, no painel da empresa.
        </p>

        <ul className="mt-2 space-y-2">
          {OPCOES_DE_VAGA.map((opcao) => (
            <LinhaDeCompra
              key={opcao.tipo}
              nome={opcao.nome}
              preco={formatPrecoBRL(PRECO_CENTAVOS[opcao.tipo] / 100)}
              nota={opcao.destaque ? "melhor preço" : undefined}
            >
              <ComprarButton
                tipo={opcao.tipo}
                rotulo="Comprar"
                ariaLabel={`Comprar ${opcao.nome}`}
                destaque={false}
                compacto
              />
            </LinhaDeCompra>
          ))}
          <LinhaDeCompra
            nome="Vagas ilimitadas"
            preco={`${mensal}/mês`}
            nota="para quem contrata todo mês"
          >
            <ComprarButton
              tipo="empresa_mensal"
              rotulo="Assinar"
              ariaLabel="Assinar o plano mensal de vagas ilimitadas"
              destaque={false}
              compacto
            />
          </LinhaDeCompra>
        </ul>
      </section>
    </div>
  );
}

function LinhaDeCompra({
  nome,
  preco,
  nota,
  children,
}: {
  nome: string;
  preco: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel px-3 py-2">
      <div className="min-w-0">
        <p className="font-semibold text-sm">
          {nome}
          <span className="ml-1.5 font-bold text-empresas">{preco}</span>
        </p>
        {nota && <p className="text-muted text-xs">{nota}</p>}
      </div>
      {children}
    </li>
  );
}
