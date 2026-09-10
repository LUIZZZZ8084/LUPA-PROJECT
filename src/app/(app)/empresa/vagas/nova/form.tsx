"use client";

import { ArrowLeft, CheckCircle2, Eye, Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";
import {
  CampoBairro,
  CampoCidade,
  useCidade,
} from "@/components/cidade-e-bairro";
import { Button, ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { CONTRACT_TYPES, JOB_CATEGORIES } from "@/lib/constants";
import { type EstadoVaga, publicarVagaComEstado } from "./actions";
import { type DadosDaVaga, lerDoFormulario, RevisaoDaVaga } from "./revisao";

const inicial: EstadoVaga = {};

/**
 * Publicar vaga, em duas etapas: preencher e conferir.
 *
 * A conferência não é conforto — é a outra metade da regra de que **vaga
 * publicada não se edita** (#173). Sem ela, corrigir um salário errado
 * custaria outro crédito, e o erro seria nosso por não ter mostrado o que
 * ia ao ar.
 *
 * **O preview lê o mesmo `FormData` que vai para a action**, e não um
 * estado paralelo mantido a cada tecla. Dois caminhos de dados aqui
 * significariam uma revisão que mostra uma coisa e publica outra — que é
 * pior do que não ter revisão, porque dá confiança sem dar garantia.
 *
 * A submissão nativa do formulário é interceptada na primeira etapa: é o
 * que faz o navegador validar os campos obrigatórios **antes** de a
 * revisão aparecer. Só depois de a pessoa confirmar é que a action roda,
 * com o mesmo `FormData` que ela acabou de ver.
 */
export function NewJobForm({ cidadeDaEmpresa }: { cidadeDaEmpresa: string }) {
  const [state, action, pending] = useActionState(
    publicarVagaComEstado,
    inicial,
  );
  const [cidade, setCidade] = useCidade(cidadeDaEmpresa);
  const [revisao, setRevisao] = useState<{
    dados: DadosDaVaga;
    formData: FormData;
  } | null>(null);
  const [enviando, comTransicao] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (state.ok) {
    return (
      <Panel className="text-center">
        <CheckCircle2 size={40} className="mx-auto text-vagas" />
        <h2 className="mt-4 text-lg font-bold">Vaga publicada</h2>
        {/*
          A cidade é a da vaga, não "Sinop" fixo. O texto chumbado dizia
          Sinop para quem tinha acabado de publicar em Sorriso — e, enquanto
          a busca também filtrava Sinop sozinha, era a promessa e o defeito
          na mesma tela.
        */}
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          Sua vaga já aparece na busca de quem está procurando emprego em{" "}
          {cidade}.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <ButtonLink href="/empresa" variant="empresas" size="sm">
            Ir para o painel
          </ButtonLink>
          <ButtonLink href="/vagas" variant="outline" size="sm">
            Ver na busca
          </ButtonLink>
        </div>
      </Panel>
    );
  }

  return (
    <>
      {/*
        Na revisão os campos continuam **montados**, só escondidos.
        Desmontá-los perderia tudo o que a pessoa digitou quando ela
        voltasse — e "voltar e corrigir" é justamente o que esta tela
        existe para oferecer. São inputs não controlados: o valor mora no
        DOM, e um `return` antecipado aqui levava o DOM junto.

        Foi um teste e2e que pegou isso, não a leitura: o comentário já
        dizia "continuam montados" enquanto o código desmontava.
      */}
      {revisao && (
        <>
          <RevisaoDaVaga dados={revisao.dados} />

          {state.erro && (
            <p className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-danger text-sm">
              {state.erro}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={enviando}
              onClick={() => setRevisao(null)}
            >
              <ArrowLeft size={16} />
              Voltar e corrigir
            </Button>

            <Button
              type="button"
              variant="empresas"
              disabled={enviando}
              onClick={() => {
                comTransicao(() => action(revisao.formData));
              }}
            >
              {enviando && <Loader2 size={16} className="animate-spin" />}
              Confirmar e publicar
            </Button>
          </div>
        </>
      )}

      <form
        ref={formRef}
        hidden={Boolean(revisao)}
        onSubmit={(evento) => {
          /*
           * O `preventDefault` só vale nesta etapa. O navegador já validou
           * os campos obrigatórios antes de chegar aqui — é por isso que a
           * interceptação é no `submit` e não num `onClick` do botão.
           */
          evento.preventDefault();
          const formData = new FormData(evento.currentTarget);
          setRevisao({ dados: lerDoFormulario(formData), formData });
        }}
      >
        <Panel className="space-y-5">
          <Field
            label="Cargo"
            required
            error={state.campos?.titulo}
            hint="Como a pessoa buscaria essa vaga, ex.: Operador de Máquinas Agrícolas."
          >
            <Input
              name="titulo"
              placeholder="Ex.: Auxiliar Administrativo"
              required
            />
          </Field>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Categoria" required error={state.campos?.categoria}>
              <Select name="categoria" required defaultValue="">
                <option value="" disabled>
                  Escolha uma área
                </option>
                {JOB_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Tipo de contrato"
              required
              error={state.campos?.tipoContrato}
            >
              <Select name="tipoContrato" required defaultValue="">
                <option value="" disabled>
                  Escolha o tipo
                </option>
                {CONTRACT_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <CampoCidade
              value={cidade}
              onChange={setCidade}
              error={state.campos?.cidade}
              label="Cidade da vaga"
            />
            <CampoBairro
              key={cidade}
              cidade={cidade}
              error={state.campos?.bairro}
            />
          </div>

          <Field
            label="Endereço"
            required
            error={state.campos?.endereco}
            hint="Rua, número e um ponto de referência. Ajuda quem depende de ônibus a decidir antes de se candidatar."
          >
            <Input
              name="endereco"
              placeholder="Ex.: Av. das Itaúbas, 1200, perto do terminal rodoviário"
              required
            />
          </Field>

          <Field
            label="Habilidades desejadas"
            hint="Separe por vírgula. Ex.: colheitadeira, CNH D. É o que o painel usa para recomendar candidatos."
            error={state.campos?.habilidades}
          >
            <Input
              name="habilidades"
              placeholder="colheitadeira, CNH D, manutenção básica"
            />
          </Field>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field
              label="Salário de (R$)"
              hint="Deixe em branco para 'a combinar'."
              error={state.campos?.salarioMin}
            >
              <Input
                name="salarioMin"
                type="number"
                min={0}
                step={100}
                inputMode="numeric"
                placeholder="1800"
              />
            </Field>

            <Field label="Salário até (R$)" error={state.campos?.salarioMax}>
              <Input
                name="salarioMax"
                type="number"
                min={0}
                step={100}
                inputMode="numeric"
                placeholder="2200"
              />
            </Field>
          </div>

          <Field
            label="Descrição da vaga"
            required
            error={state.campos?.descricao}
            hint="Atividades, requisitos e o que a empresa oferece. Separe em parágrafos."
          >
            <Textarea
              name="descricao"
              rows={9}
              required
              placeholder={
                "Atividades do dia a dia...\n\nRequisitos: ...\n\nOferecemos: vale-transporte, vale-refeição..."
              }
            />
          </Field>

          {state.erro && (
            <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {state.erro}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-line border-t pt-5">
            <p className="text-faint text-xs">
              Publicar usa uma vaga do seu saldo.{" "}
              <Link
                href="/empresa/creditos"
                className="underline hover:text-muted"
              >
                Ver meu saldo
              </Link>
            </p>
            <Button type="submit" variant="empresas" disabled={pending}>
              <Eye size={16} />
              Revisar antes de publicar
            </Button>
          </div>
        </Panel>
      </form>
    </>
  );
}
