import { KeyRound, LifeBuoy, ShieldCheck, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { Panel } from "@/components/ui/card";
import { CONTROLADOR, PRONTO_PARA_PUBLICAR } from "@/lib/controlador";
import { contatoDaSessao } from "./actions";
import { FormularioDeSuporte } from "./formulario";

export const metadata: Metadata = {
  title: "Suporte",
  description: "Como falar com a gente, e o que dá para resolver sozinho.",
};

export const dynamic = "force-dynamic";

/**
 * Suporte (#235).
 *
 * **A página abre com o que a pessoa resolve sozinha, não com o
 * formulário.** Quem chega aqui quer a resposta, não o canal — e as quatro
 * dúvidas de cima são as que o app já sabe responder. Pôr o formulário
 * primeiro transformaria pergunta respondível em mensagem na fila, e a fila
 * é atendida por duas pessoas.
 *
 * **A página é aberta**, e isso não é descuido: quem não consegue entrar é
 * exatamente quem mais precisa de suporte. Exigir sessão fecharia a porta no
 * caso mais comum.
 *
 * **As três sobem juntas.** Esta página cita os Termos e a Política em dois
 * lugares, e as duas são gateadas até o controlador existir — publicar o
 * suporte antes deixaria dois links que respondem 404, que é a armadilha
 * que este projeto condena e que eu já tropecei nela uma vez hoje. Preencher
 * `CONTROLADOR` libera o conjunto inteiro de uma vez, sem estado pela metade.
 */
export default async function SuportePage() {
  if (!PRONTO_PARA_PUBLICAR) notFound();

  const contato = await contatoDaSessao();

  return (
    <PageShell width="narrow">
      <PageTitle
        title="Suporte"
        description="Comece pelo que dá para resolver agora. Se não resolver, escreva."
      />

      <div className="mt-5 space-y-3">
        <Resposta
          icone={<KeyRound size={17} className="text-vagas" />}
          titulo="Esqueci minha senha"
        >
          Peça um link novo em{" "}
          <Link href="/esqueci-senha" className="underline">
            Esqueci minha senha
          </Link>
          . Ele chega por e-mail, vale por 1 hora e só pode ser usado uma vez.
          Se não chegar, olhe no spam. Trocar a senha desconecta os outros
          aparelhos.
        </Resposta>

        <Resposta
          icone={<ShieldCheck size={17} className="text-servicos" />}
          titulo="Não apareço na busca"
        >
          Prestador aparece na busca de serviços com o CPF confirmado{" "}
          <strong className="text-ink">e</strong> a mensalidade em dia — as duas
          coisas. Vaga aparece enquanto estiver aberta e dentro dos 30 dias;
          passou disso, dá para reativar no painel.
        </Resposta>

        <Resposta
          icone={<Wallet size={17} className="text-empresas" />}
          titulo="Paguei e não aconteceu nada"
        >
          A confirmação vem do Mercado Pago e costuma levar segundos — PIX e
          boleto podem demorar mais. Se passou do dia e nada mudou, escreva
          abaixo escolhendo{" "}
          <strong className="text-ink">
            &quot;Paguei e algo não aconteceu&quot;
          </strong>{" "}
          e diga a data: a cobrança fica registrada e dá para reprocessar.
        </Resposta>

        <Resposta
          icone={<LifeBuoy size={17} className="text-warn" />}
          titulo="Quero meus dados, ou quero sair"
        >
          Editar o perfil corrige seus dados. Para pedir cópia ou exclusão da
          conta, escreva abaixo escolhendo{" "}
          <strong className="text-ink">&quot;Meus dados&quot;</strong>. O que
          guardamos e por quanto tempo está na{" "}
          <Link href="/privacidade" className="underline">
            Política de Privacidade
          </Link>
          .
        </Resposta>
      </div>

      <Panel className="mt-6">
        <h2 className="text-sm font-bold">Escreva para a gente</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Você não precisa estar conectado para usar este formulário.
          {CONTROLADOR.email && (
            <>
              {" "}
              Se preferir, escreva direto para{" "}
              <a href={`mailto:${CONTROLADOR.email}`} className="underline">
                {CONTROLADOR.email}
              </a>
              .
            </>
          )}
        </p>

        <FormularioDeSuporte contato={contato} />
      </Panel>

      <p className="mt-6 text-xs leading-relaxed text-faint">
        A Lupa divulga e aproxima — ela não participa da contratação nem do
        pagamento entre as pessoas. Problema com um serviço prestado ou com uma
        vaga precisa ser tratado com quem você contratou; o que está do nosso
        lado, e o que não está, está nos{" "}
        <Link href="/termos" className="underline">
          Termos de Uso
        </Link>
        .
      </p>
    </PageShell>
  );
}

function Resposta({
  icone,
  titulo,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <Panel>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {icone}
        {titulo}
      </h2>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{children}</p>
    </Panel>
  );
}
