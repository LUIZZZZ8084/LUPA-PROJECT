import { Panel } from "@/components/ui/card";
import { CONTROLADOR, cnpjFormatado } from "@/lib/controlador";

/**
 * As peças que os Termos de Uso e a Política de Privacidade compartilham.
 *
 * Mora em `_legal/` — prefixo que o App Router tira do roteamento — pela
 * mesma razão de `_contratacao/`: são corpos de tela reaproveitados, não
 * rotas.
 *
 * Existe porque os dois documentos têm a mesma estrutura visual e o mesmo
 * bloco de identificação do responsável. Duplicar o cabeçalho em dois
 * arquivos é o gêmeo que diverge na primeira vez que alguém mexe num lado
 * só — o que já aconteceu neste projeto com `perfis_empresa.plano`, em três
 * telas e três correções.
 */

/**
 * Um artigo numerado.
 *
 * Numerado porque documento legal é citado por número: "o artigo 7 diz" é
 * uma frase que alguém do suporte precisa conseguir escrever. Sem número,
 * a única forma de referenciar é copiar o parágrafo inteiro.
 */
export function Artigo({
  n,
  titulo,
  children,
}: {
  n: number;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7" aria-labelledby={`artigo-${n}`}>
      <h2
        id={`artigo-${n}`}
        className="text-sm font-bold uppercase tracking-wide text-muted"
      >
        {n}. {titulo}
      </h2>
      <div className="mt-2.5 space-y-2.5 text-sm leading-relaxed text-ink">
        {children}
      </div>
    </section>
  );
}

/** Destaque para o que alguém vai reler: prazos, limites, exceções. */
export function Bloco({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-panel-2 px-4 py-3 text-sm leading-relaxed">
      {children}
    </div>
  );
}

/**
 * Quem responde pelo documento.
 *
 * Abre as duas páginas, e não fecha, de propósito: a LGPD exige que o
 * titular saiba a quem se dirigir, e informação de contato no rodapé de um
 * texto longo é informação que quem precisa não acha.
 */
export function Identificacao() {
  const cnpj = cnpjFormatado();

  return (
    <Panel className="mt-5">
      <h2 className="text-xs font-bold uppercase tracking-wide text-muted">
        Quem responde pela Lupa
      </h2>
      <div className="mt-2 space-y-0.5 text-sm text-ink">
        {CONTROLADOR.razaoSocial && <p>{CONTROLADOR.razaoSocial}</p>}
        {cnpj && <p className="text-muted text-xs">CNPJ {cnpj}</p>}
        <p className="text-muted text-xs">
          {CONTROLADOR.cidade}/{CONTROLADOR.uf}
        </p>
        {CONTROLADOR.email && (
          <p className="pt-1 text-xs">
            <a href={`mailto:${CONTROLADOR.email}`} className="underline">
              {CONTROLADOR.email}
            </a>
          </p>
        )}
      </div>
    </Panel>
  );
}

/**
 * A data da última revisão.
 *
 * Não é decoração: a LGPD obriga a avisar mudança relevante no tratamento
 * de dados, e "mudou" só significa alguma coisa contra uma data anterior.
 */
export function Revisao({ em }: { em: string }) {
  const [ano, mes, dia] = em.split("-");

  return (
    <p className="mt-8 border-t border-line pt-4 text-xs text-faint">
      Última revisão em{" "}
      <time dateTime={em}>
        {dia}/{mes}/{ano}
      </time>
      .
    </p>
  );
}
