"use client";

import { Handshake, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import type {
  LinhaDeParceria,
  SituacaoDaParceria,
} from "@/server/parceiros/tipos";
import { autorizarParceiroAction, encerrarParceriaAction } from "../actions";

/**
 * O que cada situação diz ao admin, e o que ele faz com ela (#505).
 *
 * "E-mail não confirmado" é a que mais vai aparecer, e a que mais precisa
 * de explicação: o benefício só entra com o e-mail confirmado, e o caminho é
 * pedir ao parceiro que abra o link que a Lupa mandou no cadastro.
 */
const SITUACOES: Record<
  SituacaoDaParceria,
  {
    rotulo: string;
    tom: "vagas" | "warn" | "neutral" | "outline";
    dica: string;
  }
> = {
  ativa: {
    rotulo: "Ativa",
    tom: "vagas",
    dica: "O benefício já está na conta.",
  },
  sem_conta: {
    rotulo: "Sem conta",
    tom: "outline",
    dica: "Ninguém se cadastrou com este e-mail ainda. Quando se cadastrar e confirmar o e-mail, o benefício entra sozinho.",
  },
  email_nao_confirmado: {
    rotulo: "E-mail não confirmado",
    tom: "warn",
    dica: "A conta existe. Peça para a pessoa abrir o link de confirmação que chegou no cadastro — ou reenviar pelo perfil.",
  },
  sem_beneficio: {
    rotulo: "Nada a liberar",
    tom: "neutral",
    dica: "O papel desta conta não tem nada pago para liberar.",
  },
  vencida: {
    rotulo: "Vencida",
    tom: "neutral",
    dica: "O prazo acabou. Para renovar, encerre e autorize de novo.",
  },
  encerrada: {
    rotulo: "Encerrada",
    tom: "neutral",
    dica: "Encerrada pelo admin.",
  },
};

const data = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export function Parceiros({ linhas }: { linhas: LinhaDeParceria[] }) {
  const [adicionando, setAdicionando] = useState(linhas.length === 0);
  const router = useRouter();

  const abertas = linhas.filter(
    (l) => l.situacao !== "encerrada" && l.situacao !== "vencida",
  );
  const fechadas = linhas.filter((l) => !abertas.includes(l));

  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-sm">
              <Handshake size={16} className="text-vagas" aria-hidden />
              Como funciona
            </h2>
            <ul className="mt-2 space-y-1 text-muted text-sm leading-relaxed">
              <li>
                <strong className="text-ink">Empresa</strong> ganha o plano
                ilimitado de vagas.{" "}
                <strong className="text-ink">Prestador</strong>, a vitrine em
                dia. <strong className="text-ink">Candidato</strong>, o gerador
                de currículo.
              </li>
              <li>
                O benefício só entra com o{" "}
                <strong className="text-ink">e-mail confirmado</strong> — é o
                que prova que a conta é do parceiro, e não de quem se cadastrou
                antes com o e-mail dele.
              </li>
              <li>
                Encerrar tira o que a parceria deu. O que a conta pagou além
                disso fica.
              </li>
            </ul>
          </div>
          {!adicionando && (
            <Button
              type="button"
              variant="vagas"
              size="sm"
              onClick={() => setAdicionando(true)}
            >
              <Plus size={14} aria-hidden />
              Autorizar parceiro
            </Button>
          )}
        </div>

        {adicionando && (
          <NovaParceria
            aoConcluir={() => {
              setAdicionando(false);
              router.refresh();
            }}
            aoCancelar={() => setAdicionando(false)}
          />
        )}
      </Panel>

      <section aria-labelledby="parcerias-abertas">
        <h2 id="parcerias-abertas" className="mb-3 font-bold text-base">
          Parcerias ({abertas.length})
        </h2>
        {abertas.length === 0 ? (
          <p className="text-muted text-sm">Nenhuma parceria aberta.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel">
            {abertas.map((l) => (
              <LinhaParceria key={l.id} linha={l} />
            ))}
          </ul>
        )}
      </section>

      {fechadas.length > 0 && (
        <section aria-labelledby="parcerias-fechadas">
          <h2
            id="parcerias-fechadas"
            className="mb-3 font-semibold text-muted text-sm"
          >
            Encerradas e vencidas ({fechadas.length})
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel">
            {fechadas.map((l) => (
              <LinhaParceria key={l.id} linha={l} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function LinhaParceria({ linha }: { linha: LinhaDeParceria }) {
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const situacao = SITUACOES[linha.situacao];
  const aberta = linha.situacao !== "encerrada" && linha.situacao !== "vencida";

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-sm">{linha.nome}</p>
            <Badge tone={situacao.tom}>{situacao.rotulo}</Badge>
          </div>
          <p className="mt-0.5 break-all text-muted text-xs">{linha.email}</p>
          <p className="mt-1 text-muted text-xs">
            {linha.validoAte ? `Até ${data(linha.validoAte)}` : "Sem prazo"} ·
            autorizada em {data(linha.criadoEm)}
            {linha.encerradoEm && ` · encerrada em ${data(linha.encerradoEm)}`}
          </p>
          <p className="mt-1 text-faint text-xs">{situacao.dica}</p>
        </div>

        {aberta && !confirmando && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfirmando(true)}
          >
            Encerrar
          </Button>
        )}
      </div>

      {confirmando && (
        <div className="mt-3 rounded-xl border border-line bg-panel-2 p-3">
          <p className="text-sm">
            Encerrar a parceria com <strong>{linha.nome}</strong>? O que ela deu
            à conta sai agora — a vitrine, o plano de vagas. O que a conta pagou
            por conta própria fica.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={pendente}
              onClick={() =>
                iniciar(async () => {
                  const r = await encerrarParceriaAction({ id: linha.id });
                  if (!r.ok) {
                    setErro(r.mensagem);
                    return;
                  }
                  setConfirmando(false);
                  router.refresh();
                })
              }
            >
              {pendente ? "Encerrando…" : "Encerrar parceria"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pendente}
              onClick={() => setConfirmando(false)}
            >
              Cancelar
            </Button>
          </div>
          {erro && (
            <p role="alert" className="mt-2 text-danger text-xs">
              {erro}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Nome, e-mail e prazo da parceria.
 *
 * Controlado e com `onSubmit`, sem `action` no `<form>`, como o formulário
 * de custos: o React 19 limpa o formulário de toda action que termina, até
 * da que devolveu erro (#291), e o admin perderia o que digitou.
 */
function NovaParceria({
  aoConcluir,
  aoCancelar,
}: {
  aoConcluir: () => void;
  aoCancelar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [prazo, setPrazo] = useState<"sem_prazo" | "ate_data">("sem_prazo");
  const [ate, setAte] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    iniciar(async () => {
      const r = await autorizarParceiroAction({ nome, email, prazo, ate });
      if (r.ok) {
        aoConcluir();
        return;
      }
      const porCampo = Object.fromEntries(
        (r.campos ?? []).map((c) => [c.campo, c.mensagem]),
      );
      setErros(porCampo);
      setGeral(Object.keys(porCampo).length > 0 ? null : r.mensagem);
    });
  }

  return (
    <form
      onSubmit={enviar}
      className="mt-4 space-y-3 border-line border-t pt-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nome da parceria" error={erros.nome}>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Prefeitura de Sinop"
            maxLength={80}
            autoComplete="off"
          />
        </Field>
        <Field label="E-mail da conta do parceiro" error={erros.email}>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Ex.: contato@parceiro.com.br"
            autoComplete="off"
          />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 font-medium text-sm">Prazo</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["sem_prazo", "Sem prazo"],
              ["ate_data", "Até uma data"],
            ] as const
          ).map(([valor, rotulo]) => (
            <label
              key={valor}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm transition-colors",
                prazo === valor
                  ? "border-vagas bg-vagas/10 text-ink"
                  : "border-line text-muted hover:text-ink",
              )}
            >
              <input
                type="radio"
                name="prazo"
                value={valor}
                checked={prazo === valor}
                onChange={() => setPrazo(valor)}
                className="accent-[var(--color-vagas)]"
              />
              {rotulo}
            </label>
          ))}
        </div>
        {prazo === "ate_data" && (
          <div className="mt-3 max-w-60">
            <Field label="Vale até" error={erros.ate}>
              <Input
                type="date"
                value={ate}
                onChange={(e) => setAte(e.target.value)}
              />
            </Field>
          </div>
        )}
      </fieldset>

      {geral && (
        <p role="alert" className="text-danger text-sm">
          {geral}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" variant="vagas" disabled={pendente}>
          {pendente ? "Autorizando…" : "Autorizar"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pendente}
          onClick={aoCancelar}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
