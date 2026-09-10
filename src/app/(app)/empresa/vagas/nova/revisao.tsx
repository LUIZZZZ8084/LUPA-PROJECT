"use client";

import { AlertTriangle, Banknote, MapPin, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { formatSalaryRange } from "@/lib/format";

/**
 * O que a empresa preencheu, mostrado como o candidato vai ver.
 *
 * Existe por um motivo que a #173 registra: **depois de publicada, a vaga
 * não pode mais ser editada**. Sem uma conferência antes, o único jeito de
 * corrigir uma vírgula seria publicar de novo — e publicar custa crédito.
 *
 * O preview lê os mesmos campos que vão para o banco, e não um segundo
 * caminho de dados: o que a pessoa confere aqui é literalmente o que ela
 * mandou. Uma tela de revisão que renderiza outra coisa é pior que não ter
 * revisão nenhuma, porque ela dá confiança sem dar garantia.
 */
export interface DadosDaVaga {
  titulo: string;
  categoria: string;
  tipoContrato: string;
  cidade: string;
  bairro: string;
  endereco: string;
  habilidades: string;
  salarioMin: string;
  salarioMax: string;
  descricao: string;
}

export function lerDoFormulario(formData: FormData): DadosDaVaga {
  const ler = (campo: string) => String(formData.get(campo) ?? "").trim();
  return {
    titulo: ler("titulo"),
    categoria: ler("categoria"),
    tipoContrato: ler("tipoContrato"),
    cidade: ler("cidade"),
    bairro: ler("bairro"),
    endereco: ler("endereco"),
    habilidades: ler("habilidades"),
    salarioMin: ler("salarioMin"),
    salarioMax: ler("salarioMax"),
    descricao: ler("descricao"),
  };
}

/** O mesmo formatador que o card e o detalhe da vaga usam. */
function salario(dados: DadosDaVaga): string {
  return formatSalaryRange(
    dados.salarioMin ? Number(dados.salarioMin) : null,
    dados.salarioMax ? Number(dados.salarioMax) : null,
  );
}

export function RevisaoDaVaga({ dados }: { dados: DadosDaVaga }) {
  const habilidades = dados.habilidades
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

  const local = [dados.bairro, dados.cidade].filter(Boolean).join(", ");

  return (
    /*
     * Um landmark com nome: o formulário continua montado por baixo (só
     * escondido), então "Logística e Transporte" existe duas vezes na
     * página — aqui e na `option` do select. Sem um contêiner nomeado,
     * tanto o leitor de tela quanto o teste teriam de adivinhar qual é.
     */
    <section aria-label="Revisão da vaga" className="space-y-4">
      {/*
        O aviso vem antes do preview, não depois do botão.

        É a mesma regra do aviso de virar prestador: quem escreve o aviso
        confere se ele aparece na hora em que a decisão é tomada. Depois do
        botão, não é aviso — é registro para quem for reclamar.
      */}
      <Panel className="border-warn/30 bg-warn/8">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 flex-none text-warn" />
          <div>
            <h2 className="font-bold text-base">
              Depois de publicada, esta vaga não pode ser editada
            </h2>
            <ul className="mt-2 space-y-1.5 text-muted text-sm leading-relaxed">
              <li>
                Confira o cargo, o salário e a descrição agora. Corrigir depois
                só publicando outra vaga, e{" "}
                <strong className="text-ink">isso gasta outro crédito</strong>.
              </li>
              <li>
                Você pode <strong className="text-ink">encerrar</strong> a vaga
                quando quiser — o que não dá é trocar o conteúdo dela.
              </li>
              <li>
                A vaga fica <strong className="text-ink">30 dias</strong> no ar.
                Depois disso ela sai da busca.
              </li>
            </ul>
          </div>
        </div>
      </Panel>

      <Panel>
        <p className="text-faint text-xs uppercase tracking-wide">
          Como o candidato vai ver
        </p>

        <h3 className="mt-2 font-bold text-lg leading-snug">{dados.titulo}</h3>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {dados.categoria && <Badge tone="vagas">{dados.categoria}</Badge>}
          {dados.tipoContrato && <Badge>{dados.tipoContrato}</Badge>}
        </div>

        <dl className="mt-4 space-y-2.5 text-sm">
          <div className="flex items-start gap-2">
            <Banknote size={16} className="mt-0.5 flex-none text-muted" />
            <div>
              <dt className="sr-only">Salário</dt>
              <dd className="font-semibold">{salario(dados)}</dd>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <MapPin size={16} className="mt-0.5 flex-none text-muted" />
            <div>
              <dt className="sr-only">Local</dt>
              <dd>
                {local}
                {dados.endereco && (
                  <span className="block text-muted">{dados.endereco}</span>
                )}
              </dd>
            </div>
          </div>

          {habilidades.length > 0 && (
            <div className="flex items-start gap-2">
              <Tag size={16} className="mt-0.5 flex-none text-muted" />
              <div>
                <dt className="sr-only">Habilidades</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {habilidades.map((h) => (
                    <Badge key={h}>{h}</Badge>
                  ))}
                </dd>
              </div>
            </div>
          )}
        </dl>

        <div className="mt-4 border-line border-t pt-4">
          <h4 className="font-bold text-sm">Descrição</h4>
          {/*
            `whitespace-pre-line` porque a descrição vem de um textarea e a
            empresa separa em parágrafos — o formulário até pede isso. Sem
            preservar as quebras, o preview mostraria um bloco corrido que
            não é o que vai ao ar.
          */}
          <p className="mt-1.5 whitespace-pre-line text-muted text-sm leading-relaxed">
            {dados.descricao}
          </p>
        </div>
      </Panel>
    </section>
  );
}
