"use client";

import { BellOff, BellRing } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { CIDADES, JOB_CATEGORIES } from "@/lib/constants";

/**
 * Avisos de vaga nova (#48).
 *
 * A ordem aqui não é estética. **A permissão do navegador só se pede uma
 * vez**: negada, não há como perguntar de novo — nem no mesmo aparelho, nem
 * depois de a pessoa mudar de ideia. Por isso o pedido vem *depois* de ela
 * escolher cidade e área e apertar o botão, quando já sabe o que está
 * aceitando. Pedir ao abrir a tela queimaria a única chance com quem ainda
 * não entendeu a oferta.
 *
 * Sem `pushDisponivel` (chaves VAPID ausentes), a tela diz que o recurso
 * não está no ar em vez de aceitar a escolha e engolir — a mesma regra do
 * envio de arquivo sem Supabase.
 */

type Estado = "parado" | "salvando" | "ligado" | "negado" | "sem-suporte";

export function AvisosDeVaga({
  preferencia,
  cidadePadrao,
  pushDisponivel,
  chavePublica,
  salvar,
  desligar,
  inscrever,
}: {
  preferencia: { cidade: string; categoria: string | null } | null;
  cidadePadrao: string;
  pushDisponivel: boolean;
  chavePublica: string;
  salvar: (dados: FormData) => Promise<{ ok: boolean }>;
  desligar: () => Promise<{ ok: boolean }>;
  inscrever: (dados: FormData) => Promise<{ ok: boolean }>;
}) {
  const [estado, setEstado] = useState<Estado>(
    preferencia ? "ligado" : "parado",
  );
  const [pendente, comTransicao] = useTransition();

  if (!pushDisponivel) {
    return (
      <Panel className="mb-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <BellRing size={16} className="text-vagas" />
          Avisos de vaga nova
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          Ainda não está no ar neste ambiente. Quando estiver, você escolhe uma
          cidade e uma área e o telefone avisa quando aparecer vaga.
        </p>
      </Panel>
    );
  }

  async function ligar(formData: FormData) {
    setEstado("salvando");

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setEstado("sem-suporte");
      return;
    }

    // A preferência é gravada antes de pedir a permissão: se a pessoa negar,
    // a escolha dela não se perde, e ligar depois é um clique.
    const salvo = await salvar(formData);
    if (!salvo.ok) {
      setEstado("parado");
      return;
    }

    const permissao = await Notification.requestPermission();
    if (permissao !== "granted") {
      setEstado("negado");
      return;
    }

    const registro = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const assinatura = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: chavePublica,
    });

    const bruta = assinatura.toJSON();
    const corpo = new FormData();
    corpo.set("endpoint", bruta.endpoint ?? "");
    corpo.set("p256dh", bruta.keys?.p256dh ?? "");
    corpo.set("auth", bruta.keys?.auth ?? "");

    const ok = await inscrever(corpo);
    setEstado(ok.ok ? "ligado" : "parado");
  }

  return (
    <Panel className="mb-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <BellRing size={16} className="text-vagas" />
        Avisos de vaga nova
      </h2>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">
        O telefone avisa quando aparecer vaga na cidade e área que você
        escolher. Vaga boa some rápido, e ninguém abre o app todo dia.
      </p>

      <form action={ligar} className="mt-4 space-y-4">
        <Field label="Cidade" required>
          <Select
            name="cidade"
            defaultValue={preferencia?.cidade ?? cidadePadrao}
          >
            {CIDADES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Área"
          hint="Deixe em todas para receber qualquer vaga da cidade."
        >
          <Select name="categoria" defaultValue={preferencia?.categoria ?? ""}>
            <option value="">Todas as áreas</option>
            {JOB_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>

        {estado === "negado" && (
          <p className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
            O navegador bloqueou os avisos. Sua escolha foi salva — para
            receber, libere as notificações da Lupa nas configurações do
            navegador e volte aqui.
          </p>
        )}

        {estado === "sem-suporte" && (
          <p className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
            Este navegador não recebe avisos. No iPhone, é preciso primeiro
            adicionar a Lupa à tela de início.
          </p>
        )}

        {estado === "ligado" && (
          <p
            role="status"
            className="rounded-xl border border-vagas/30 bg-vagas/10 px-4 py-3 text-sm text-vagas"
          >
            Avisos ligados neste aparelho.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="vagas" size="sm" disabled={pendente}>
            {estado === "ligado" ? "Atualizar avisos" : "Ligar avisos"}
          </Button>

          {/*
           * Desligar apaga a preferência e todos os aparelhos — "dá para
           * desativar facilmente" é critério da Issue, e meia desativação
           * (parar de avisar, guardar o que a pessoa procurava) manteria
           * justamente o dado que este projeto evita guardar.
           */}
          {estado === "ligado" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pendente}
              onClick={() =>
                comTransicao(async () => {
                  await desligar();
                  setEstado("parado");
                })
              }
            >
              <BellOff size={14} />
              Desligar
            </Button>
          )}
        </div>
      </form>
    </Panel>
  );
}
