import { ArrowRight, Check, CheckCircle2 } from "lucide-react";
import { ComprarButton } from "@/app/(app)/_contratacao/comprar-button";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { formatPrecoBRL } from "@/lib/format";
import { OPCAO_AVULSA, PLANOS_DE_VAGA } from "@/lib/planos-empresa";
import {
  PRECO_CENTAVOS,
  VAGAS_NO_AR_POR_PLANO,
} from "@/server/pagamentos/planos";

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
 * **Botões de 44 px sem perder a dobra (#481).** Em aparelho de toque os
 * botões pequenos passaram de 36 para 44 px. Cada linha de compra tinha 52 px
 * (36 do botão e 16 de respiro) e continua com 52 (44 e 8), e o espaço entre
 * os blocos caiu de 16 para 12 para pagar os 8 px do "Continuar grátis". A
 * tela inteira continua cabendo em 844 px de altura, que o teste confere.
 *
 * As opções e os botões continuam os mesmos de `/empresa/creditos` — mesma
 * lista (`PLANOS_DE_VAGA` e `OPCAO_AVULSA`), mesmo `ComprarButton`, mesma
 * action. O saldo não entra: quem acabou de criar a conta tem zero.
 */

const BENEFICIOS_GRATIS = [
  "Perfil da empresa no ar",
  "Buscar entre quem pediu para ser encontrado",
  "Primeira vaga grátis, com o CNPJ conferido",
];

export function SelecaoDePlanoEmpresa() {
  return (
    <div className="space-y-3">
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
          <LinhaDeCompra
            nome={OPCAO_AVULSA.nome}
            preco={formatPrecoBRL(PRECO_CENTAVOS[OPCAO_AVULSA.tipo] / 100)}
            nota="compra única"
          >
            <ComprarButton
              tipo={OPCAO_AVULSA.tipo}
              rotulo="Comprar"
              ariaLabel="Comprar 1 vaga"
              destaque={false}
              compacto
            />
          </LinhaDeCompra>
          {PLANOS_DE_VAGA.map((plano) => {
            const limite = VAGAS_NO_AR_POR_PLANO[plano.tipo];
            return (
              <LinhaDeCompra
                key={plano.tipo}
                nome={plano.nome}
                preco={`${formatPrecoBRL(PRECO_CENTAVOS[plano.tipo] / 100)}/mês`}
                nota={limite ? `até ${limite} vagas no ar` : "vagas sem contar"}
              >
                <ComprarButton
                  tipo={plano.tipo}
                  rotulo="Assinar"
                  ariaLabel={`Assinar o ${plano.nome}`}
                  destaque={false}
                  compacto
                />
              </LinhaDeCompra>
            );
          })}
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
    <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel px-3 py-1">
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
