import { MessageCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { whatsappLink } from "@/lib/format";
import type {
  Recomendado,
  VagaComRecomendados,
} from "@/server/candidaturas/recomendados";

/**
 * "Recomendados para você".
 *
 * Cada linha diz **por que** aquela pessoa está ali — quais habilidades
 * casaram com o que a vaga pede. Recomendação sem motivo é adivinhação:
 * quem recebe não tem como discordar do critério, e a primeira vez que
 * discordar em silêncio deixa de olhar o bloco.
 *
 * As duas listas ficam separadas, e a separação é o produto: quem se
 * candidatou levantou a mão para esta vaga; quem está disponível pediu
 * para ser encontrado, mas ainda não escolheu você.
 */
export function Recomendados({ vagas }: { vagas: VagaComRecomendados[] }) {
  // Sem nada a recomendar, o bloco não aparece. Título com estado vazio
  // ocuparia a parte mais valiosa da tela para dizer "nada aqui".
  if (vagas.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-1 flex items-center gap-2 text-base font-bold">
        <Sparkles size={17} className="text-empresas" />
        Recomendados para você
      </h2>
      <p className="mb-3 text-xs text-muted">
        Quem mais combina com o que cada vaga pede, do mais perto do local da
        vaga para o mais longe.
      </p>

      <div className="space-y-4">
        {vagas.map((vaga) => (
          <Panel key={vaga.vagaId} className="p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">{vaga.titulo}</h3>
              <p className="text-[11px] text-muted">
                {vaga.cidade} · pede {vaga.pedidas.length}{" "}
                {vaga.pedidas.length === 1 ? "habilidade" : "habilidades"}
              </p>
            </div>

            {vaga.candidatos.length > 0 && (
              <Lista
                titulo="Entre quem se candidatou"
                pessoas={vaga.candidatos}
                vaga={vaga.titulo}
              />
            )}

            {vaga.disponiveis.length > 0 && (
              <Lista
                titulo="Disponíveis para contato"
                dica="Pediram para ser encontrados. Ainda não se candidataram a esta vaga."
                pessoas={vaga.disponiveis}
                vaga={vaga.titulo}
              />
            )}
          </Panel>
        ))}
      </div>
    </section>
  );
}

function Lista({
  titulo,
  dica,
  pessoas,
  vaga,
}: {
  titulo: string;
  dica?: string;
  pessoas: Recomendado[];
  vaga: string;
}) {
  return (
    <div className="mt-4 border-t border-line pt-3 first:mt-3">
      <h4 className="text-[11px] font-semibold tracking-wide text-muted uppercase">
        {titulo}
      </h4>
      {dica && <p className="mt-0.5 text-[11px] text-muted">{dica}</p>}

      <ul className="mt-2 space-y-2">
        {pessoas.map((p) => (
          <li key={p.id}>
            <Pessoa pessoa={p} vaga={vaga} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pessoa({ pessoa, vaga }: { pessoa: Recomendado; vaga: string }) {
  const corpo = (
    <>
      <Avatar name={pessoa.nome} src={pessoa.avatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{pessoa.nome}</p>
        <p className="mt-0.5 text-[11px] text-muted">
          {pessoa.casadas.length} de {pessoa.deQuantas} habilidades
          {pessoa.cidade
            ? ` · ${[pessoa.bairro, pessoa.cidade].filter(Boolean).join(", ")}`
            : ""}
        </p>

        {/*
          O texto que a pessoa escreveu, não a forma interna: quem lê
          precisa reconhecer as próprias palavras para confiar no
          casamento.
        */}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {pessoa.casadas.map((h) => (
            <Badge key={h.canonica} tone="vagas">
              {h.texto}
            </Badge>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div className="flex items-start gap-2">
      {/*
        Quem se candidatou tem ficha — com currículo, estágio e histórico.
        Quem só está disponível não tem: ele entregou contato, não
        currículo. Por isso um é link e o outro não.
      */}
      {pessoa.candidaturaId ? (
        <Link
          href={`/empresa/candidaturas/${pessoa.candidaturaId}`}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-xl p-2 transition-colors hover:bg-panel-2"
        >
          {corpo}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-start gap-3 p-2">{corpo}</div>
      )}

      {pessoa.telefone && (
        <a
          href={whatsappLink(
            pessoa.telefone,
            `Olá! Somos uma empresa da Lupa e temos uma vaga de ${vaga} que combina com o seu perfil. Podemos conversar?`,
          )}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Falar com ${pessoa.nome} no WhatsApp`}
          className="mt-2 flex-none rounded-lg border border-line p-2 text-muted transition-colors hover:border-vagas hover:text-vagas"
        >
          <MessageCircle size={16} />
        </a>
      )}
    </div>
  );
}
