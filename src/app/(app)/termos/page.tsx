import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { Panel } from "@/components/ui/card";
import {
  CONTROLADOR,
  PRONTO_PARA_PUBLICAR,
  REVISADO_EM,
} from "@/lib/controlador";
import { formatPrecoBRL } from "@/lib/format";
import { PRECO_CENTAVOS } from "@/server/pagamentos/planos";
import { Artigo, Bloco, Identificacao, Revisao } from "../_legal/estrutura";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "As regras de uso da Lupa, e o que a plataforma não faz.",
};

export const dynamic = "force-dynamic";

/*
 * `formatPrecoBRL`, e nunca `formatMoneyBRL`.
 *
 * O segundo arredonda — é para métrica aproximada de painel — e
 * transformava "R$ 19,90" em "R$ 20" **dentro de um documento legal**. O
 * comentário em `src/lib/format.ts` avisa exatamente disso, e eu usei o
 * helper errado assim mesmo; foi o teste dos preços que pegou.
 *
 * Preço errado numa tela é inconveniente. Num Termos de Uso é publicidade
 * enganosa — e este arquivo tem um parágrafo dizendo isso sobre preço
 * digitado à mão, enquanto anunciava o valor errado por outro motivo.
 */
const preco = (centavos: number) => formatPrecoBRL(centavos / 100);

/**
 * Termos de Uso.
 *
 * A posição que o documento inteiro sustenta, decidida pelo Luiz em
 * 14/09/2026: **a Lupa é plataforma de intermediação e divulgação, e nada
 * além disso.** Ela aproxima quem procura de quem oferece, e não entra na
 * relação que os dois criarem.
 *
 * Isso não é retórica defensiva — é o que o produto de fato faz. A Lupa não
 * seleciona candidato, não intermedeia contrato, não recebe pelo serviço
 * prestado entre usuários, não garante contratação e não confere a
 * veracidade do que cada um escreve no próprio anúncio. Escrever qualquer
 * coisa além disso criaria obrigação que o software não cumpre — o defeito
 * que este projeto já registra cinco vezes, agora com peso jurídico.
 *
 * **Os preços são lidos de `PRECO_CENTAVOS`, nunca digitados aqui.** Preço
 * repetido é como se cobra um valor e se anuncia outro, e num documento
 * legal isso deixa de ser inconveniente e vira publicidade enganosa.
 *
 * O apoio de "não respondo pelo que o usuário publica" é o art. 19 do Marco
 * Civil da Internet; o de arrependimento é o art. 49 do CDC. Os dois estão
 * citados no texto porque quem lê precisa poder conferir.
 */
export default function TermosPage() {
  /*
   * Enquanto o controlador não existir, a página não existe.
   *
   * Documento legal sem responsável identificado é pior que documento
   * nenhum: dá aparência de conformidade sem entregar nenhuma, e promete
   * um canal de direitos sem dizer a quem se dirigir.
   */
  if (!PRONTO_PARA_PUBLICAR) notFound();

  return (
    <PageShell width="narrow">
      <PageTitle
        title="Termos de Uso"
        description="O que a Lupa faz, o que ela não faz, e o que se espera de quem usa."
      />

      <Identificacao />

      <Artigo n={1} titulo="O que é a Lupa">
        <p>
          A Lupa é uma <strong>plataforma de divulgação e intermediação</strong>
          . Ela aproxima quem procura trabalho de quem oferece, e quem procura
          um serviço de quem o presta, dentro de Mato Grosso.
        </p>
        <p>
          O que acontece depois desse encontro é entre as pessoas envolvidas. A
          Lupa não participa, não acompanha e não responde por isso.
        </p>
      </Artigo>

      <Artigo n={2} titulo="O que a Lupa não é, e não faz">
        <Bloco>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Não é empregadora, nem agência de emprego, nem representante de
              quem contrata ou de quem é contratado.
            </li>
            <li>
              Não participa, não intermedeia e não fiscaliza o contrato de
              trabalho, a prestação de serviço ou o pagamento combinado entre
              usuários. Esse dinheiro nunca passa pela Lupa.
            </li>
            <li>
              Não seleciona, não indica e não recomenda pessoas. A ordem em que
              os anúncios aparecem é automática — proximidade e data — e está
              explicada na própria tela.
            </li>
            <li>
              Não garante contratação, resposta, qualidade do serviço, nem que
              qualquer anúncio resulte em alguma coisa.
            </li>
            <li>
              Não confere a veracidade do que cada pessoa escreve sobre si. O
              que é conferido está no artigo 4, e só isso.
            </li>
          </ul>
        </Bloco>
        <p>
          Cobramos pela <strong>divulgação</strong> — o espaço e as ferramentas.
          Nunca por contratação, colocação ou resultado.
        </p>
      </Artigo>

      <Artigo n={3} titulo="Quem pode usar">
        <p>
          Criar conta de candidato exige <strong>16 anos completos</strong>, que
          é a idade mínima para trabalhar no Brasil fora do contrato de
          aprendizagem. Contratar, anunciar serviço ou fazer qualquer compra
          exige <strong>18 anos</strong> e capacidade civil.
        </p>
        <p>
          Cada pessoa tem uma conta, e ela é pessoal. Você responde pelo que
          acontece nela, e deve nos avisar se suspeitar que alguém entrou.
        </p>
      </Artigo>

      <Artigo n={4} titulo="O que é conferido, e o que isso prova">
        <p>
          Duas coisas são conferidas automaticamente, e o alcance exato de cada
          uma importa — porque nenhuma delas prova identidade.
        </p>
        <Bloco>
          <p>
            <strong>CPF</strong> — conferimos se é válido e se não está em uso
            por outra conta. <em>Não</em> consultamos a Receita Federal, e isso
            não prova que o CPF é de quem o digitou.
          </p>
          <p className="mt-2">
            <strong>CNPJ</strong> — consultamos a base pública da Receita
            Federal para saber se a empresa existe e está ativa, e usamos a
            razão social que ela devolve. Isso prova que a empresa existe;{" "}
            <em>não</em> prova que quem se cadastrou é dono dela.
          </p>
        </Bloco>
        <p>
          Não pedimos foto de documento nem selfie, e não há tela para
          enviá-los.
        </p>
      </Artigo>

      <Artigo n={5} titulo="O que você publica é seu, e é sua responsabilidade">
        <p>
          O conteúdo que você publica — anúncio, vaga, foto de trabalho,
          avaliação, currículo — continua sendo seu. Ao publicar, você autoriza
          a Lupa a exibi-lo dentro da plataforma, para a finalidade de
          divulgação.
        </p>
        <p>
          Você garante que tem direito sobre o que publica, e responde pelo
          conteúdo. Nos termos do{" "}
          <strong>art. 19 da Lei 12.965/2014 (Marco Civil da Internet)</strong>,
          a Lupa não responde civilmente por conteúdo publicado por terceiros, e
          só é obrigada a removê-lo mediante ordem judicial específica — o que
          não nos impede de remover, por conta própria, o que violar estes
          termos.
        </p>
      </Artigo>

      <Artigo n={6} titulo="O que não é permitido">
        <Bloco>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Anunciar vaga ou serviço que não existe.</li>
            <li>
              Cobrar qualquer valor de candidato para participar de seleção —
              taxa de cadastro, exame, uniforme ou material. É o golpe mais
              comum em plataforma de emprego, e resulta em remoção imediata.
            </li>
            <li>Passar-se por outra pessoa ou empresa.</li>
            <li>
              Usar dado de contato obtido aqui para outra finalidade que não a
              do anúncio, inclusive envio de propaganda.
            </li>
            <li>
              Discriminar em anúncio, por qualquer critério vedado em lei.
            </li>
            <li>Raspar, copiar em massa ou automatizar acesso à plataforma.</li>
          </ul>
        </Bloco>
      </Artigo>

      <Artigo n={7} titulo="Pagamentos, e o que cada um compra">
        <p>Os valores cobrados hoje, todos por divulgação e ferramentas:</p>
        <Bloco>
          <ul className="space-y-1.5">
            <li>
              <strong>Prestador</strong> — mensalidade de{" "}
              {preco(PRECO_CENTAVOS.prestador_mensalidade)}, que mantém o perfil
              visível na busca de serviços.
            </li>
            <li>
              <strong>Quem contrata</strong> — publicação de vaga a partir de{" "}
              {preco(PRECO_CENTAVOS.empresa_vaga_avulsa)} por vaga, com pacotes,
              ou plano mensal de {preco(PRECO_CENTAVOS.empresa_mensal)}.
            </li>
            <li>
              <strong>Candidato</strong> — gerador de currículo em PDF, compra
              única de {preco(PRECO_CENTAVOS.curriculo_pdf)}.
            </li>
          </ul>
        </Bloco>
        <p>
          <strong>O que o candidato paga não compra vaga.</strong> O gerador de
          currículo é uma ferramenta de documento: não dá prioridade, não
          destaca o perfil, não influencia nenhuma seleção e não muda nada no
          que quem contrata vê. Nenhum pagamento na Lupa compra colocação.
        </p>
        <p>
          O pagamento é processado pelo Mercado Pago. A Lupa não recebe nem
          guarda dado de cartão.
        </p>
      </Artigo>

      <Artigo n={8} titulo="Arrependimento, cancelamento e devolução">
        <Bloco>
          <p>
            <strong>Arrependimento em 7 dias.</strong> Pelo{" "}
            <strong>art. 49 do Código de Defesa do Consumidor</strong>, qualquer
            compra feita aqui pode ser desfeita em até 7 dias corridos, com
            devolução integral e sem precisar de justificativa. Basta pedir pelo
            suporte.
          </p>
        </Bloco>
        <p>
          <strong>Devolução da primeira mensalidade em 30 dias.</strong> Além do
          direito acima, a primeira cobrança da assinatura de prestador pode ser
          devolvida integralmente em até 30 dias, pela própria plataforma. Vale
          uma vez por conta: da segunda cobrança em diante, o que existe é o
          cancelamento.
        </p>
        <p>
          <strong>Cancelar é diferente de devolver.</strong> Cancelar interrompe
          as cobranças futuras e mantém o serviço até o fim do período já pago.
          Devolver encerra o serviço na hora.
        </p>
      </Artigo>

      <Artigo n={9} titulo="Suspensão e encerramento">
        <p>
          Podemos suspender ou encerrar uma conta que descumpra estes termos,
          avisando o motivo. Você pode encerrar a sua quando quiser, pelo
          suporte.
        </p>
        <p>
          Encerrar a conta não apaga o que já produziu efeito para outra pessoa
          — uma avaliação que alguém recebeu, por exemplo. O que acontece com
          seus dados está na Política de Privacidade.
        </p>
      </Artigo>

      <Artigo n={10} titulo="Limite da nossa responsabilidade">
        <p>
          A Lupa responde pelo funcionamento da plataforma. Não responde por
          prejuízo decorrente da relação entre usuários — contratação que não
          aconteceu, serviço malfeito, pagamento não honrado, informação falsa
          publicada por alguém.
        </p>
        <p>
          A plataforma é oferecida como está, e pode ficar indisponível para
          manutenção ou por falha de serviços de terceiros dos quais depende.
        </p>
      </Artigo>

      <Artigo n={11} titulo="Mudanças nestes termos">
        <p>
          Podemos alterar estes termos. Mudança relevante é avisada dentro do
          app antes de valer, e a data da última revisão fica no rodapé desta
          página.
        </p>
      </Artigo>

      <Artigo n={12} titulo="Lei e foro">
        <p>
          Aplica-se a lei brasileira. Fica eleito o foro da comarca de{" "}
          {CONTROLADOR.cidade}/{CONTROLADOR.uf}, salvo quando a lei garantir ao
          consumidor o foro do seu domicílio — caso em que prevalece o dele.
        </p>
      </Artigo>

      <Revisao em={REVISADO_EM} />

      <Panel className="mt-5">
        <p className="text-xs leading-relaxed text-muted">
          Dúvida sobre qualquer ponto? A página de{" "}
          <strong className="text-ink">Suporte</strong> tem os canais de
          contato.
        </p>
      </Panel>
    </PageShell>
  );
}
