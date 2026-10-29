"use client";

import { Download, FileText, FlaskConical, Megaphone } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { formatPrecoBRL } from "@/lib/format";
import type { DireitoDePublicar } from "@/server/carteiras/servico";
import type { TipoPagamento } from "@/server/pagamentos/tipos";
import { testarCompraAction } from "../actions";

type Testavel =
  | "curriculo_pdf"
  | "empresa_vaga_avulsa"
  | "empresa_plano_5"
  | "empresa_plano_10"
  | "empresa_mensal";

/**
 * Os cinco produtos que a área sabe testar (#516), na ordem em que a pessoa
 * os encontra no app: o currículo do candidato, e depois a escada de vagas
 * da tela de planos.
 */
const COMPRAS: {
  tipo: Testavel;
  titulo: string;
  oQueAcontece: string;
}[] = [
  {
    tipo: "curriculo_pdf",
    titulo: "Gerador de currículo",
    oQueAcontece:
      "Libera o gerador na sua conta e baixa o PDF montado com os dados dela.",
  },
  {
    tipo: "empresa_vaga_avulsa",
    titulo: "1 vaga avulsa",
    oQueAcontece: "Soma um crédito de vaga na carteira da sua empresa.",
  },
  {
    tipo: "empresa_plano_5",
    titulo: "Plano 5 vagas",
    oQueAcontece: "Ativa o plano por 30 dias, com até 5 vagas no ar.",
  },
  {
    tipo: "empresa_plano_10",
    titulo: "Plano 10 vagas",
    oQueAcontece: "Ativa o plano por 30 dias, com até 10 vagas no ar.",
  },
  {
    tipo: "empresa_mensal",
    titulo: "Plano ilimitado",
    oQueAcontece: "Ativa o plano por 30 dias, sem limite de vagas no ar.",
  },
];

type Resultado =
  | { tipo: "pdf"; url: string | null; tamanhoKb: number }
  | { tipo: "carteira"; carteira: DireitoDePublicar }
  | { tipo: "erro"; mensagem: string };

const data = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/**
 * O PDF chega em base64 e vira arquivo aqui.
 *
 * O download começa sozinho, porque é o que o candidato vê ao clicar em
 * "Baixar". O link fica na tela para baixar de novo sem gerar outra vez.
 */
function arquivoDoPdf(base64: string): { url: string | null; bytes: number } {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);

  // Sem `createObjectURL` (o ambiente de teste não tem), mostra o tamanho e
  // não o link.
  if (typeof URL.createObjectURL !== "function") {
    return { url: null, bytes: bytes.length };
  }
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/pdf" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "curriculo-teste.pdf";
  a.click();
  return { url, bytes: bytes.length };
}

export function TestesDeCompra({
  precos,
}: {
  precos: Record<TipoPagamento, number>;
}) {
  return (
    <div className="space-y-5">
      <Panel className="border-warn/25 bg-warn/5">
        <h2 className="flex items-center gap-2 font-semibold text-sm">
          <FlaskConical size={16} className="text-warn" aria-hidden />
          Como funciona
        </h2>
        <ul className="mt-2 space-y-1 text-muted text-sm leading-relaxed">
          <li>
            O pagamento é dado como{" "}
            <strong className="text-ink">aprovado na hora</strong>, sem
            checkout, PIX ou cartão. O que roda depois é o mesmo de uma compra
            de verdade.
          </li>
          <li>
            Vale só para a <strong className="text-ink">sua conta</strong>. Para
            dar um produto a outra pessoa, use Parceiros.
          </li>
          <li>
            <strong className="text-ink">Não entra no caixa</strong>: nenhuma
            cobrança é gravada, então o painel continua mostrando só o dinheiro
            que entrou.
          </li>
        </ul>
      </Panel>

      <ul className="space-y-3">
        {COMPRAS.map((compra) => (
          <li key={compra.tipo}>
            <LinhaDeCompra
              {...compra}
              preco={formatPrecoBRL(precos[compra.tipo] / 100)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function LinhaDeCompra({
  tipo,
  titulo,
  oQueAcontece,
  preco,
}: {
  tipo: Testavel;
  titulo: string;
  oQueAcontece: string;
  preco: string;
}) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [pendente, iniciar] = useTransition();
  const Icone = tipo === "curriculo_pdf" ? FileText : Megaphone;

  function testar() {
    iniciar(async () => {
      const r = await testarCompraAction({ tipo });
      if (!r.ok) {
        setResultado({ tipo: "erro", mensagem: r.mensagem });
        return;
      }
      if (r.dados.pdfBase64) {
        const { url, bytes } = arquivoDoPdf(r.dados.pdfBase64);
        setResultado({
          tipo: "pdf",
          url,
          tamanhoKb: Math.max(1, Math.round(bytes / 1024)),
        });
        return;
      }
      if (r.dados.carteira) {
        setResultado({ tipo: "carteira", carteira: r.dados.carteira });
      }
    });
  }

  return (
    <Panel>
      {/* No celular o botão desce, para não espremer a descrição. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Icone
            size={18}
            className="mt-0.5 flex-none text-empresas"
            aria-hidden
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-sm">{titulo}</h2>
              <Badge tone="outline">{preco}</Badge>
            </div>
            <p className="mt-1 text-muted text-sm">{oQueAcontece}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={pendente}
          onClick={testar}
        >
          {pendente ? "Liberando…" : "Comprar sem pagar"}
        </Button>
      </div>

      {resultado && <MostrarResultado resultado={resultado} />}
    </Panel>
  );
}

function MostrarResultado({ resultado }: { resultado: Resultado }) {
  if (resultado.tipo === "erro") {
    return (
      <p role="alert" className="mt-3 text-danger text-sm">
        {resultado.mensagem}
      </p>
    );
  }

  if (resultado.tipo === "pdf") {
    return (
      <div
        role="status"
        className="mt-3 rounded-xl border border-line bg-panel-2 p-3 text-sm"
      >
        <p>
          Gerador liberado. O PDF ({resultado.tamanhoKb} KB) foi gerado pela
          mesma função do candidato.
        </p>
        {resultado.url && (
          <a
            href={resultado.url}
            download="curriculo-teste.pdf"
            className="mt-2 inline-flex items-center gap-1.5 font-medium text-empresas underline-offset-2 hover:underline"
          >
            <Download size={14} aria-hidden />
            Baixar de novo
          </a>
        )}
      </div>
    );
  }

  const { carteira } = resultado;
  return (
    <div
      role="status"
      className="mt-3 rounded-xl border border-line bg-panel-2 p-3 text-sm"
    >
      <p className="font-medium">Como a carteira ficou</p>
      <ul className="mt-1 space-y-0.5 text-muted">
        <li>
          Créditos de vaga:{" "}
          <strong className="text-ink">{carteira.creditos}</strong>
        </li>
        <li>
          Plano:{" "}
          <strong className="text-ink">
            {carteira.mensalAtivo && carteira.mensalidadeValidaAte
              ? `até ${data(carteira.mensalidadeValidaAte)}, ${
                  carteira.limiteNoAr === null
                    ? "sem limite de vagas no ar"
                    : `até ${carteira.limiteNoAr} vagas no ar`
                }`
              : "nenhum ativo"}
          </strong>
        </li>
        <li>
          Pode publicar agora:{" "}
          <strong className="text-ink">{carteira.pode ? "sim" : "não"}</strong>
        </li>
      </ul>
      <Link
        href="/empresa/creditos"
        className="mt-2 inline-block font-medium text-empresas underline-offset-2 hover:underline"
      >
        Ver na área de contratação
      </Link>
    </div>
  );
}
