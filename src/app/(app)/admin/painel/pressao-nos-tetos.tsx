import { Gauge, ShieldAlert } from "lucide-react";
import { Panel } from "@/components/ui/card";
import type { PressaoNoTeto } from "@/server/metrics/tipos";

/**
 * Quem está encostando nos tetos, agora (#207).
 *
 * O AGENTS.md registra duas decisões de não proteger ainda — captcha fora
 * de escopo, borda paga só "quando aparecer abuso medido". A segunda
 * pressupõe alguém medindo, e ninguém media: em 12/09/2026 a pergunta
 * "estamos perto de cair?" foi respondida abrindo o painel do Supabase e
 * contando conexão à mão.
 *
 * Este bloco é a resposta, e é deliberadamente pequena. A Issue nasceu
 * pedindo tabela nova com contagem por rota e por dia; a decisão do Luiz em
 * 14/09/2026 foi **não criar**. Volume por rota a Vercel já conta — é o
 * medidor da fatura dela, e é a cota do plano que acaba primeiro, não o
 * banco. O que faltava era o sinal de recusa, e ele já estava em
 * `tentativas_de_acesso`.
 *
 * **É "agora", nunca tendência, e a tela diz isso.** A fonte se limpa
 * sozinha algumas janelas depois. Guardar histórico seria guardar dado, e é
 * exatamente o que se escolheu não fazer.
 *
 * **E é por ação, nunca por pessoa.** A chave da tabela é
 * `login:<e-mail>` nas de autenticação — a agregação mora na view
 * `metricas_pressao` para que ela não saia do banco.
 */
export function PressaoNosTetos({ linhas }: { linhas: PressaoNoTeto[] }) {
  const bloqueadasAgora = linhas.reduce((soma, l) => soma + l.bloqueadas, 0);

  return (
    <Panel>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Gauge size={16} className="text-warn" />
        Pressão nos limites
      </h2>
      <p className="mt-1 text-xs text-muted">
        Só agora — a contagem se apaga sozinha, não é histórico. Por ação; nunca
        por pessoa.
      </p>

      {/*
        O aviso só aparece quando existe, e é o gatilho escrito de uma
        decisão: "rate limit na borda vale quando aparecer abuso medido".
        Enquanto isto for zero, não apareceu — e dizer isso aqui evita que
        a decisão fique esperando um sinal que ninguém sabe onde ler.
      */}
      {bloqueadasAgora > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          <ShieldAlert size={15} className="mt-0.5 flex-none" />
          <span>
            {bloqueadasAgora}{" "}
            {bloqueadasAgora === 1 ? "chave bloqueada" : "chaves bloqueadas"}{" "}
            neste momento. É este o abuso medido que a decisão de pôr limite na
            borda está esperando — se não parar sozinho, é hora de olhar.
          </span>
        </p>
      )}

      {linhas.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Ninguém encostando em teto nenhum. É a lista que se quer vazia — e
          vazia aqui quer dizer mesmo vazia, porque toda escrita do app passa
          por um orçamento desde a #202.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {linhas.map((linha) => (
            <li key={linha.rotulo} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm">
                {linha.rotulo}
              </span>

              <span className="flex-none text-[11px] text-muted tabular-nums">
                {linha.chamadas} {linha.chamadas === 1 ? "chamada" : "chamadas"}{" "}
                · {linha.chaves} {linha.chaves === 1 ? "origem" : "origens"} ·
                pico {linha.pico}
              </span>

              {/*
                O bloqueio é o único número que muda uma decisão, então é o
                único que ganha cor. Os outros três existem para separar
                trânsito de abuso: vinte origens com três chamadas é um dia
                movimentado; uma origem com sessenta é uma pessoa só — ou um
                script.
              */}
              {linha.bloqueadas > 0 && (
                <span className="flex-none rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-semibold text-danger tabular-nums">
                  {linha.bloqueadas} bloqueada
                  {linha.bloqueadas === 1 ? "" : "s"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
