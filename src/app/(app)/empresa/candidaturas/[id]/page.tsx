import {
  Briefcase,
  CalendarClock,
  FileText,
  Mail,
  MapPin,
  MessageCircle,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { BackLink, PageShell } from "@/components/layout/page-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { APPLICATION_LABELS, APPLICATION_TONE } from "@/lib/constants";
import { formatPhone, timeAgo, whatsappLink } from "@/lib/format";
import { sessaoAtual } from "@/server/auth/cookies";
import {
  fichaDaCandidatura,
  marcarComoVisualizada,
} from "@/server/candidaturas/ficha";
import { MoverCandidaturaSelect } from "../../mover-candidatura-select";
import { CopiarEmail } from "./copiar-email";

export const metadata: Metadata = {
  title: "Candidatura",
  description: "Currículo e contato de quem se candidatou à sua vaga.",
};

export default async function FichaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessao = await sessaoAtual();
  const ficha = await fichaDaCandidatura(sessao, id);

  // `null` cobre "não existe" e "não é sua" — um erro diferente para cada
  // caso confirmaria, para quem sonda ids, que a candidatura existe.
  if (!ficha) notFound();

  const { candidatura, linkCurriculo } = ficha;
  const c = candidatura.candidate;

  /*
   * Sai por `after()`, depois da resposta: quem abriu a ficha quer ler a
   * ficha. Se a marcação falhar, o estágio continua "Nova" e alguém
   * marca à mão — melhor do que a página não abrir.
   */
  after(() => marcarComoVisualizada(candidatura.id));

  const mensagem =
    `Olá, ${primeiroNome(c.full_name)}! Vimos sua candidatura para a vaga ` +
    `de ${candidatura.job_title} na Lupa e gostaríamos de conversar.`;

  return (
    <PageShell width="narrow">
      <BackLink href="/empresa" label="Voltar para Minha Empresa" />

      <Panel>
        <div className="flex items-start gap-4">
          <Avatar name={c.full_name} src={c.avatar_url} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl leading-tight font-bold">{c.full_name}</h1>
            <p className="mt-1 text-xs text-muted">
              Candidatou-se a{" "}
              <span className="font-semibold text-ink">
                {candidatura.job_title}
              </span>{" "}
              · {timeAgo(candidatura.created_at)}
            </p>
            <div className="mt-2.5">
              <Badge tone={APPLICATION_TONE[candidatura.status]}>
                {APPLICATION_LABELS[candidatura.status]}
              </Badge>
            </div>
          </div>
        </div>

        {/*
          O contato vem primeiro, antes do currículo.
          Currículo que chega e não vira conversa é a mesma coisa que
          currículo que não chegou — o caminho até "chamar a pessoa" tem
          que ser o mais curto da tela.
        */}
        <div className="mt-5 flex flex-wrap gap-2">
          {c.phone && (
            <ButtonLink
              href={whatsappLink(c.phone, mensagem)}
              target="_blank"
              rel="noopener noreferrer"
              variant="vagas"
            >
              <MessageCircle size={17} />
              Falar no WhatsApp
            </ButtonLink>
          )}
          {c.email && (
            <ButtonLink href={`mailto:${c.email}`} variant="outline">
              <Mail size={17} />
              Enviar e-mail
            </ButtonLink>
          )}
        </div>

        {c.email && <CopiarEmail email={c.email} />}
        {c.phone && (
          <p className="mt-1 text-[11px] text-muted">
            WhatsApp: {formatPhone(c.phone)}
          </p>
        )}
      </Panel>

      <Panel className="mt-5">
        <h2 className="text-base font-bold">Sobre a pessoa</h2>

        <dl className="mt-3 space-y-3 text-sm">
          <Linha icone={<MapPin size={15} />} rotulo="Onde mora">
            {[c.neighborhood, c.city].filter(Boolean).join(" · ") ||
              "Não informado"}
          </Linha>
          <Linha icone={<Briefcase size={15} />} rotulo="Área desejada">
            {c.desired_area ?? "Não informada"}
          </Linha>
          <Linha icone={<CalendarClock size={15} />} rotulo="Disponibilidade">
            {c.availability ?? "Não informada"}
          </Linha>
        </dl>

        {c.summary && (
          <Secao titulo="Resumo">
            <p className="leading-relaxed whitespace-pre-line">{c.summary}</p>
          </Secao>
        )}

        {c.experiences.length > 0 && (
          <Secao titulo="Experiência">
            <ul className="space-y-3">
              {c.experiences.map((e) => (
                <li key={`${e.company}-${e.role}-${e.period}`}>
                  <p className="font-semibold">{e.role}</p>
                  <p className="text-[11px] text-muted">
                    {e.company} · {e.period}
                  </p>
                  {e.description && (
                    <p className="mt-1 leading-relaxed">{e.description}</p>
                  )}
                </li>
              ))}
            </ul>
          </Secao>
        )}

        {c.education && (
          <Secao titulo="Formação">
            <p>{c.education}</p>
          </Secao>
        )}

        {c.skills.length > 0 && (
          <Secao titulo="Habilidades">
            <div className="flex flex-wrap gap-1.5">
              {c.skills.map((h) => (
                <Badge key={h} tone="neutral">
                  {h}
                </Badge>
              ))}
            </div>
          </Secao>
        )}

        {/*
          O link do currículo nasce a cada visita e expira em um minuto: o
          arquivo mora em bucket privado, e o banco guarda o caminho, não a
          URL. Por isso ele não é copiável nem compartilhável — de
          propósito.
        */}
        <Secao titulo="Currículo em PDF">
          {linkCurriculo ? (
            <ButtonLink
              href={linkCurriculo}
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              size="sm"
            >
              <FileText size={16} />
              Abrir currículo
            </ButtonLink>
          ) : (
            <p className="text-muted">
              A pessoa ainda não enviou currículo em PDF.
            </p>
          )}
        </Secao>
      </Panel>

      <Panel className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Estágio no seu processo</h2>
            <p className="mt-1 text-xs text-muted">
              Só você vê isto. A pessoa não é avisada da mudança.
            </p>
          </div>
          <MoverCandidaturaSelect
            id={candidatura.id}
            statusAtual={candidatura.status}
          />
        </div>
      </Panel>
    </PageShell>
  );
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

function Linha({
  icone,
  rotulo,
  children,
}: {
  icone: React.ReactNode;
  rotulo: string;
  children: React.ReactNode;
}) {
  /*
   * `dt` e `dd` são filhos diretos do `div` que embrulha o par.
   *
   * A versão anterior punha o ícone como irmão e descia mais um `div`
   * antes deles: `dl > div > div > dt`. O HTML aceita **um** `div`
   * embrulhando o par, e não dois — com o segundo, `dt` e `dd` deixam de
   * pertencer à lista, e leitor de tela para de anunciar "Onde mora" como
   * o rótulo de "Jardim Primavera · Sinop": lê duas frases soltas. O axe
   * acusa como `definition-list` e `dlitem`, impacto sério, e ninguém
   * tinha visto porque esta tela nunca passou por varredura.
   *
   * O ícone foi para dentro do `dt`, que é onde ele pertence: ele ilustra
   * o rótulo, não a linha.
   */
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-2 text-[11px] text-muted">
        <span className="flex-none">{icone}</span>
        {rotulo}
      </dt>
      {/* Alinha o valor com o rótulo, descontando ícone e espaço. */}
      <dd className="mt-0.5 pl-[23px]">{children}</dd>
    </div>
  );
}

function Secao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 border-t border-line pt-4 text-sm">
      <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-muted uppercase">
        {titulo}
      </h3>
      {children}
    </section>
  );
}
