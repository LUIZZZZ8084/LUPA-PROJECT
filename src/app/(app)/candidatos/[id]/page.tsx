import {
  Briefcase,
  CalendarClock,
  EyeOff,
  FileText,
  MapPin,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  arquivarPelaAba,
  editarComFotoComEstado,
  publicarComFotoComEstado,
} from "@/app/(app)/perfil/publicacoes/actions";
import { AbasDoPerfil, GerenciarTrabalhos } from "@/components/abas-do-perfil";
import { BackLink, PageShell } from "@/components/layout/page-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { sessaoAtual } from "@/server/auth/cookies";
import { perfilDoCandidato } from "@/server/candidatos/servico";
import {
  listarPublicacoes,
  resumo as resumoDePublicacoes,
} from "@/server/publicacoes/servico";

export const metadata: Metadata = {
  title: "Candidato",
  description: "Quem pediu para ser encontrado por empresas.",
};

export default async function CandidatoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessao = await sessaoAtual();
  const perfil = await perfilDoCandidato(sessao, id);

  /*
   * `null` cobre "não existe", "não consentiu" e "você não pode ver". Os
   * três respondem igual de propósito: distinguir confirmaria, para quem
   * sonda ids, que a pessoa existe e está procurando emprego — que é
   * exatamente o que o opt-in protege.
   */
  if (!perfil) notFound();

  const { candidato: c, candidaturaId, ehDono, visivelParaEmpresas } = perfil;

  /*
   * O feed do candidato, nas mesmas condições do prestador.
   *
   * Decisão do Luiz em 03/09/2026: "faz igual do prestador, a diferença é
   * que ele não tem as opções de avaliação". Reputação tem autor e se
   * constrói prestando serviço; quem procura emprego é avaliado na
   * entrevista, não por estrelas de desconhecidos.
   */
  const [trabalhos, resumoTrabalhos] = await Promise.all([
    listarPublicacoes(c.id, "ativa"),
    resumoDePublicacoes(c.id),
  ]);

  const paraAba = trabalhos.map((t) => ({
    id: t.id,
    titulo: t.titulo,
    corpo: t.corpo,
    imagemUrl: t.imagemUrl,
  }));

  return (
    <PageShell width="narrow">
      <BackLink
        href={ehDono ? "/perfil" : "/candidatos"}
        label={ehDono ? "Voltar para o perfil" : "Voltar para candidatos"}
      />

      <Panel>
        <div className="flex items-start gap-4">
          <Avatar name={c.full_name} src={c.avatar_url} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl leading-tight font-bold">{c.full_name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
              <MapPin size={13} />
              {[c.neighborhood, c.city].filter(Boolean).join(", ")}
            </p>
            <div className="mt-2.5">
              {visivelParaEmpresas ? (
                <Badge tone="vagas">Disponível para contato</Badge>
              ) : (
                <Badge tone="neutral">Invisível para empresas</Badge>
              )}
            </div>
          </div>
        </div>

        {c.phone && (
          <div className="mt-5">
            <WhatsAppButton
              phone={c.phone}
              providerName={c.full_name}
              context={c.desired_area ?? "uma vaga"}
              size="lg"
              block
            />
          </div>
        )}
      </Panel>

      {ehDono && !visivelParaEmpresas && (
        /*
         * O dono precisa saber por que ninguém o encontra.
         *
         * "Quero que empresas me encontrem" nasce desligado de propósito:
         * numa cidade do tamanho de Sinop, quem está empregado e
         * procurando outra coisa pode ter o patrão atual entre as
         * empresas cadastradas. O padrão está certo — o que faltava era
         * dizer isto na cara de quem abre a própria prévia e não se acha
         * na busca.
         */
        <Panel className="mt-5 border-warn/30 bg-warn/8">
          <p className="flex items-center gap-2 font-semibold text-sm text-warn">
            <EyeOff size={15} />
            Só você vê este perfil
          </p>
          <p className="mt-1.5 text-muted text-sm leading-relaxed">
            Empresas não encontram você enquanto &ldquo;quero que empresas me
            encontrem&rdquo; estiver desligado. É assim de propósito — ninguém
            fica visível sem pedir.{" "}
            <Link href="/perfil/editar" className="text-vagas underline">
              Ligar no perfil
            </Link>
            .
          </p>
        </Panel>
      )}

      <Panel className="mt-5">
        <AbasDoPerfil
          trabalhos={paraAba}
          vazio={
            ehDono
              ? "Você ainda não publicou nenhum trabalho. Uma foto do que você já fez conta mais para quem contrata do que qualquer descrição."
              : "Esta pessoa ainda não publicou trabalhos."
          }
          acoesDoDono={
            ehDono ? (
              <GerenciarTrabalhos
                restantes={resumoTrabalhos.restantes}
                limite={resumoTrabalhos.limite}
                publicar={publicarComFotoComEstado}
              />
            ) : null
          }
          /*
           * Editar e remover vivem dentro da foto ampliada. A lista de
           * títulos abaixo da grade desenhava o mesmo item duas vezes, e a
           * segunda sem foto — decisão do Luiz em 03/09/2026, olhando para
           * o resultado na tela.
           */
          dono={
            ehDono
              ? { editar: editarComFotoComEstado, excluir: arquivarPelaAba }
              : undefined
          }
          sobre={
            <div className="pt-5">
              <dl className="mt-3 space-y-3">
                <Linha
                  icone={<Briefcase size={14} />}
                  rotulo="Área desejada"
                  valor={c.desired_area ?? "Não informada"}
                />
                <Linha
                  icone={<CalendarClock size={14} />}
                  rotulo="Disponibilidade"
                  valor={c.availability ?? "Não informada"}
                />
              </dl>

              {c.skills.length > 0 && (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="text-xs text-muted">Habilidades</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {c.skills.map((h) => (
                      <Badge key={h} tone="vagas">
                        {h}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/*
          Currículo só por candidatura, e é isso que esta seção diz nos dois
          casos.

          São dois consentimentos diferentes: quem se candidata entrega o
          currículo junto com a candidatura; quem só está visível entregou
          contato. Ligar "quero ser encontrado" não pode significar "leia
          meu histórico inteiro" — por isso a view que responde a esta tela
          não traz currículo nem resumo, e não há o que revelar aqui nem
          por engano.
        */}
              <div className="mt-5 border-t border-line pt-4">
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <FileText size={13} />
                  Currículo
                </p>
                {candidaturaId ? (
                  <>
                    <p className="mt-1.5 text-sm text-muted">
                      Esta pessoa se candidatou a uma das suas vagas — o
                      currículo está na ficha da candidatura.
                    </p>
                    <div className="mt-3">
                      <ButtonLink
                        href={`/empresa/candidaturas/${candidaturaId}`}
                        variant="empresas"
                        size="sm"
                      >
                        Ver a candidatura
                      </ButtonLink>
                    </div>
                  </>
                ) : (
                  <p className="mt-1.5 text-sm text-muted">
                    O currículo vem junto com a candidatura. Quem está aqui
                    pediu para ser encontrado e entregou o contato — não o
                    histórico.
                  </p>
                )}
              </div>
            </div>
          }
        />
      </Panel>
    </PageShell>
  );
}

function Linha({
  icone,
  rotulo,
  valor,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: string;
}) {
  return (
    <div className="flex gap-3">
      <dt className="flex w-36 flex-none items-center gap-1.5 text-xs text-muted">
        {icone}
        {rotulo}
      </dt>
      <dd className="min-w-0 flex-1 text-sm">{valor}</dd>
    </div>
  );
}
