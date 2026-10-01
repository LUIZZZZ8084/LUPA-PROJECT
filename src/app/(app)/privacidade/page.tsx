import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import {
  CONTROLADOR,
  PRONTO_PARA_PUBLICAR,
  REVISADO_EM,
} from "@/lib/controlador";
import { Artigo, Bloco, Identificacao, Revisao } from "../_legal/estrutura";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Que dados a Lupa guarda, por quê, e o que é público.",
};

export const dynamic = "force-dynamic";

/**
 * Política de Privacidade.
 *
 * Escrita **lendo o `schema.sql`**, e não a tela — porque a tela estava
 * errada. Foi ao começar este documento que apareceu a #233: três telas
 * afirmavam que CPF e CNPJ não ficavam guardados, e uma delas dizia que o
 * CPF era conferido na Receita. Os dois ficam, e o CPF nunca vai à Receita.
 *
 * Isso vale como método: **política de privacidade se escreve a partir do
 * banco, não a partir do que o produto diz de si.** Um documento que
 * descreve o tratamento errado é pior que nenhum — ele consente em nome da
 * pessoa por algo diferente do que acontece.
 *
 * A seção que carrega o peso deste app é a 3, "o que é público". Aqui a
 * diferença entre um dado fechado e um dado na vitrine não é detalhe
 * técnico: numa cidade do tamanho de Sinop, currículo visível é a
 * informação de que alguém quer sair do emprego atual.
 */
export default function PrivacidadePage() {
  if (!PRONTO_PARA_PUBLICAR) notFound();

  return (
    <PageShell width="narrow">
      <PageTitle
        title="Política de Privacidade"
        description="O que guardamos, por quê, o que fica visível e como você manda apagar."
      />

      <Identificacao />

      <Artigo n={1} titulo="O resumo, em cinco linhas">
        <Bloco>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Guardamos o necessário para a conta existir e você ser encontrado.
            </li>
            <li>
              <strong>Seu currículo não é público</strong>, e só chega a quem
              você se candidatou.
            </li>
            <li>
              <strong>Seu CPF não aparece para ninguém.</strong> O CNPJ aparece,
              porque é registro público.
            </li>
            <li>Não vendemos dado seu, para ninguém, nunca.</li>
            <li>Você pode pedir cópia ou exclusão a qualquer momento.</li>
          </ul>
        </Bloco>
      </Artigo>

      <Artigo n={2} titulo="O que guardamos">
        <p>
          <strong>De toda conta:</strong> nome, e-mail, telefone, cidade,
          bairro, senha (guardada como hash, nunca em texto), foto de perfil se
          você enviar, e a data do último acesso.
        </p>
        <p>
          <strong>De quem procura trabalho:</strong> área desejada, resumo,
          experiências, formação, habilidades, disponibilidade, arquivo de
          currículo se enviar, e as candidaturas que fez.
        </p>
        <p>
          <strong>De quem presta serviço:</strong> categoria, descrição, preço
          inicial, anos de experiência, bairros atendidos, fotos de trabalho,
          redes sociais, CPF, e CNPJ com razão social se tiver.
        </p>
        <p>
          <strong>De quem contrata:</strong> razão social, CNPJ ou CPF, setor,
          porte, site, redes sociais, descrição, logo, e as vagas publicadas.
        </p>
        <p>
          <strong>De uso:</strong> tentativas de acesso (para conter ataque de
          senha), contagem de visualizações por vaga e por dia, e termos
          buscados que não acharam nada.{" "}
          <strong>
            As duas últimas não ligam nada a você — são contagem, sem dono.
          </strong>
        </p>
        <p>
          <strong>De pagamento:</strong> valor, tipo, situação e o identificador
          da transação no Mercado Pago.{" "}
          <strong>Não recebemos nem guardamos dado de cartão.</strong>
        </p>
      </Artigo>

      <Artigo n={3} titulo="O que é público, e o que nunca é">
        <p>
          Esta é a parte mais importante desta página, e a que mais muda a vida
          de alguém.
        </p>
        <Bloco>
          <p className="font-semibold text-ink">Fica visível</p>
          <p className="mt-1">
            Nome, foto, cidade e bairro, e o conteúdo do seu anúncio — se você é
            prestador ou contrata. Avaliações recebidas. CNPJ e razão social,
            que são registro público. O telefone do prestador, porque é por ele
            que o contato acontece.
          </p>
          <p className="mt-3 font-semibold text-ink">Nunca fica visível</p>
          <p className="mt-1">
            <strong>Seu CPF.</strong> Fica numa área que só o servidor alcança —
            a mesma onde fica o hash da senha — e serve apenas para conferir que
            é válido e único.
          </p>
          <p className="mt-1">
            <strong>Seu currículo, resumo e experiências.</strong> Não entram em
            nenhuma busca pública. Chegam à empresa apenas quando <em>você</em>{" "}
            se candidata a uma vaga dela.
          </p>
          <p className="mt-1">
            <strong>Seu e-mail e sua senha.</strong>
          </p>
        </Bloco>
        <p>
          <strong>Ser encontrado por empresas nasce desligado.</strong> Existe
          uma opção no perfil do candidato que permite a empresas encontrarem
          você sem que você tenha se candidatado. Ela vem desligada, e mesmo
          ligada entrega <em>contato</em>, não currículo. O motivo de nascer
          desligada é concreto: numa cidade deste tamanho, o seu patrão atual
          pode estar entre as empresas cadastradas.
        </p>
      </Artigo>

      <Artigo n={4} titulo="Por que guardamos cada coisa">
        <p>As bases legais são as do art. 7º da Lei 13.709/2018 (LGPD):</p>
        <Bloco>
          <ul className="space-y-1.5">
            <li>
              <strong>Execução do contrato</strong> (inciso V) — conta, perfil,
              anúncios, candidaturas, pagamentos. Sem isso a plataforma não
              funciona.
            </li>
            <li>
              <strong>Obrigação legal</strong> (inciso II) — registros de acesso
              e dados fiscais das cobranças.
            </li>
            <li>
              <strong>Consentimento</strong> (inciso I) — ser encontrado por
              empresas, e receber aviso de vaga nova. Os dois nascem desligados
              e você desliga quando quiser.
            </li>
            <li>
              <strong>Legítimo interesse</strong> (inciso IX) — conter fraude e
              ataque de senha, e entender o que as pessoas buscam sem achar.
            </li>
          </ul>
        </Bloco>
      </Artigo>

      <Artigo n={5} titulo="Com quem compartilhamos">
        <p>
          Com ninguém, para fins próprios deles. Os serviços abaixo tratam dado
          <em> por nossa conta e ordem</em>, como operadores, e só o necessário:
        </p>
        <Bloco>
          <ul className="space-y-1.5">
            <li>
              <strong>Supabase</strong> — banco de dados e armazenamento de
              arquivos.
            </li>
            <li>
              <strong>Vercel</strong> — hospedagem da aplicação.
            </li>
            <li>
              <strong>Mercado Pago</strong> — processamento de pagamento. Os
              dados de cartão vão direto para lá, sem passar pela Lupa.
            </li>
            <li>
              <strong>Resend</strong> — envio dos e-mails da conta (confirmação,
              recuperação de senha).
            </li>
            <li>
              <strong>BrasilAPI</strong> — consulta pública de CNPJ. Enviamos
              apenas o número consultado.
            </li>
          </ul>
        </Bloco>
        <p>
          <strong>
            Não vendemos dado, não fazemos publicidade dirigida e não entregamos
            sua base a ninguém.
          </strong>{" "}
          Fora isso, só entregamos dado por ordem judicial ou requisição legal.
        </p>
      </Artigo>

      <Artigo n={6} titulo="Por quanto tempo">
        <p>
          Enquanto sua conta existir. Pedindo a exclusão, apagamos o que
          identifica você.
        </p>
        <p>
          O que fica, e por quê: registros de pagamento, pelo prazo fiscal e
          legal; registros de acesso, pelo prazo do Marco Civil da Internet; e
          conteúdo que já produziu efeito para outra pessoa — uma avaliação que
          alguém recebeu continua no perfil dela, sem o seu nome.
        </p>
        <p>
          As tentativas de acesso se apagam sozinhas em algumas horas. As
          contagens de visualização e de busca não identificam ninguém, então
          permanecem como estatística.
        </p>
      </Artigo>

      <Artigo n={7} titulo="Seus direitos, e como usar">
        <p>
          O art. 18 da LGPD garante a você: confirmar que tratamos seus dados,
          pedir cópia, corrigir o que está errado, pedir exclusão, saber com
          quem compartilhamos, e retirar consentimento.
        </p>
        <Bloco>
          <p>
            Escreva para{" "}
            {CONTROLADOR.email ? (
              <a href={`mailto:${CONTROLADOR.email}`} className="underline">
                {CONTROLADOR.email}
              </a>
            ) : (
              "o contato indicado no topo desta página"
            )}
            , ou use a página de Suporte. Respondemos em até 15 dias.
          </p>
          <p className="mt-2 text-xs text-muted">
            Boa parte disso você faz sozinho: editar o perfil corrige dados,
            desligar &quot;ser encontrado por empresas&quot; retira aquele
            consentimento na hora, e desligar o aviso de vaga apaga junto a
            preferência e os aparelhos registrados.
          </p>
        </Bloco>
      </Artigo>

      <Artigo n={8} titulo="Segurança">
        <p>
          A senha é guardada com Argon2id, e nunca em texto. A conexão é
          cifrada. O CPF, o currículo e as candidaturas ficam em tabelas que a
          chave pública do aplicativo não alcança — só o servidor.
        </p>
        <p>
          Trocar a senha desconecta os outros aparelhos. Nenhum sistema é
          perfeito, e se acontecer um incidente que traga risco relevante a
          você, avisamos você e a ANPD.
        </p>
      </Artigo>

      <Artigo n={9} titulo="Cookies">
        <p>
          Usamos um cookie só, o da sua sessão — é ele que mantém você
          conectado. Não usamos cookie de publicidade nem de rastreamento entre
          sites, e por isso não há banner de consentimento para clicar.
        </p>
      </Artigo>

      <Artigo n={10} titulo="Adolescentes">
        <p>
          A Lupa aceita candidatos a partir de 16 anos, idade mínima para
          trabalhar no Brasil fora do contrato de aprendizagem. Não coletamos
          dado de menores de 16 conscientemente; se descobrirmos, apagamos.
        </p>
      </Artigo>

      <Artigo n={11} titulo="Mudanças">
        <p>
          Se mudarmos a forma como tratamos seus dados, avisamos dentro do app
          antes de valer. A data da última revisão está logo abaixo.
        </p>
      </Artigo>

      <Revisao em={REVISADO_EM} />
    </PageShell>
  );
}
