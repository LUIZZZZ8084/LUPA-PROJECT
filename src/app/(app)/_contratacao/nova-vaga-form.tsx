"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  Infinity as Infinito,
  Loader2,
  Ticket,
} from "lucide-react";
import { useActionState, useRef, useState, useTransition } from "react";
import { CampoCidade, useCidade } from "@/components/campo-cidade";
import { CompartilharVaga } from "@/components/compartilhar-vaga";
import { Button, ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  CONTRACT_TYPES,
  JOB_CATEGORIES,
  WORK_MODE_LABELS,
  WORK_MODES,
} from "@/lib/constants";
import { type DireitoParaTela, resumoDoDireito } from "@/lib/planos-empresa";
import { cn } from "@/lib/utils";
import type { AreaDeContratacao } from "./area";
import { type EstadoVaga, publicarVagaComEstado } from "./nova-vaga-actions";
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
export function NewJobForm({
  cidadeDaEmpresa,
  area,
  direito,
  modelo = null,
}: {
  cidadeDaEmpresa: string;
  area: AreaDeContratacao;
  /**
   * O texto de uma vaga antiga da própria empresa, para publicar outra
   * parecida (#492). Só preenche os campos: nada vai ao ar sem a revisão, e a
   * vaga nova gasta uma vaga do saldo como qualquer outra.
   */
  modelo?: Omit<DadosDaVaga, "perguntas"> | null;
  /**
   * O que a pessoa pode publicar hoje — para a tela avisar **antes**.
   *
   * Informa, não autoriza: quem decide de verdade é `gastarParaPublicar`,
   * na mesma instrução que grava. Aqui o valor pode estar velho por
   * alguns segundos, e isso é aceitável para um aviso; seria inaceitável
   * para um portão.
   */
  direito: DireitoParaTela;
}) {
  const semSaldo = !direito.pode;
  const resumo = resumoDoDireito(direito);
  const [state, action, pending] = useActionState(
    publicarVagaComEstado,
    inicial,
  );
  const [cidade, setCidade] = useCidade(modelo?.cidade || cidadeDaEmpresa);
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
        {/*
          A divulgação aparece na hora (#490): é quando a empresa mais quer
          espalhar a vaga, e o link já abre sem login, com prévia.
        */}
        {state.vagaId && revisao && (
          <div className="mx-auto mt-5 max-w-sm border-line border-t pt-5 text-left">
            <CompartilharVaga
              recolhido
              vagaId={state.vagaId}
              cargo={revisao.dados.titulo}
              cidade={cidade}
              titulo="Divulgue agora"
            />
          </div>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <ButtonLink href={area.base} variant="empresas" size="sm">
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
        O saldo vem antes dos campos, e diz o número (#193).

        O aviso morava no rodapé, em 12px cinza-claro, e dizia só *que*
        publicar usa uma vaga — nunca quantas a pessoa tem. Quem estava
        zerado preenchia dez campos para descobrir no fim. Avisar no
        começo é mais barato para ela e não custa nada para quem tem
        saldo.
      */}
      {!revisao && modelo && (
        <Panel className="mb-4 border-empresas/30">
          <p className="text-sm leading-relaxed">
            Preenchido com o texto de <strong>{modelo.titulo}</strong>. Confira
            tudo e ajuste o que mudou: esta é uma vaga nova, e a revisão vem
            antes de ir ao ar.
          </p>
        </Panel>
      )}
      {!revisao && (
        <Panel className={cn("mb-4", semSaldo && "border-warn/40 bg-warn/10")}>
          <div className="flex items-start gap-3">
            {semSaldo ? (
              <AlertTriangle size={18} className="mt-0.5 flex-none text-warn" />
            ) : direito.mensalAtivo ? (
              <Infinito size={18} className="mt-0.5 flex-none text-empresas" />
            ) : (
              <Ticket size={18} className="mt-0.5 flex-none text-empresas" />
            )}

            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm">{resumo.titulo}</p>
              <p className="mt-0.5 text-muted text-sm leading-relaxed">
                {resumo.detalhe}
              </p>

              {semSaldo && (
                <ButtonLink
                  href={`${area.base}/creditos`}
                  variant="empresas"
                  size="sm"
                  className="mt-3"
                >
                  <Ticket size={15} />
                  Ver planos e vagas
                </ButtonLink>
              )}
            </div>
          </div>
        </Panel>
      )}
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
            <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3">
              <p className="text-danger text-sm">{state.erro}</p>

              {/*
                A recusa por saldo oferece a saída, em vez de ser um beco.

                A pessoa acabou de escrever a vaga inteira e foi barrada.
                Sem este botão ela tem que descobrir sozinha onde comprar,
                saindo da tela — e os campos vivem no DOM, então sair
                perde tudo. O `campos.creditos` é o que distingue esta
                recusa de um erro de validação qualquer: só o serviço de
                vaga o produz, em `publicarVaga` e `reativarVaga`.
              */}
              {state.campos?.creditos && (
                <ButtonLink
                  href={`${area.base}/creditos`}
                  variant="empresas"
                  size="sm"
                  className="mt-3"
                >
                  <Ticket size={15} />
                  Ver planos e vagas
                </ButtonLink>
              )}
            </div>
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
              defaultValue={modelo?.titulo}
              required
            />
          </Field>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Categoria" required error={state.campos?.categoria}>
              <Select
                name="categoria"
                required
                defaultValue={modelo?.categoria ?? ""}
              >
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
              <Select
                name="tipoContrato"
                required
                defaultValue={modelo?.tipoContrato ?? ""}
              >
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

          {/*
            Botões à vista, e não um select (#300): são só três opções, e a
            escolha vira o selo que o candidato lê no card — ver as três de
            uma vez deixa claro que existe a pergunta.
          */}
          <fieldset>
            <legend className="mb-2 font-medium text-sm">
              Modalidade <span className="text-danger">*</span>
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {WORK_MODES.map((modo) => (
                <label
                  key={modo}
                  className="flex min-h-11 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-line px-2 py-2.5 text-center text-[13px] text-muted leading-tight transition-colors hover:border-line-soft has-[:checked]:border-empresas has-[:checked]:bg-empresas/8 has-[:checked]:text-ink"
                >
                  <input
                    type="radio"
                    name="modalidade"
                    value={modo}
                    defaultChecked={modelo?.modalidade === modo}
                    required
                    className="accent-empresas"
                  />
                  {WORK_MODE_LABELS[modo]}
                </label>
              ))}
            </div>
            {state.campos?.modalidade && (
              <p className="mt-1.5 text-danger text-xs">
                {state.campos.modalidade}
              </p>
            )}
          </fieldset>

          {/*
            Obrigatória e sem resposta de antemão (#456): quem procura
            filtra por isto, e uma vaga que "não respondeu" não é nem sim
            nem não. São só duas opções, à vista, como a modalidade.
          */}
          <fieldset>
            <legend className="mb-1 font-medium text-sm">
              Esta vaga é para pessoa com deficiência (PCD){" "}
              <span className="text-danger">*</span>
            </legend>
            <p className="mb-2 text-faint text-xs">
              Diga &ldquo;Sim&rdquo; se a vaga é destinada a PCD, como as das
              cotas da Lei 8.213/91. Ela ganha um selo e aparece no filtro de
              quem procura.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["sim", "Sim, é para PCD"],
                  ["nao", "Não é para PCD"],
                ] as const
              ).map(([valor, rotulo]) => (
                <label
                  key={valor}
                  className="flex min-h-11 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-line px-2 py-2.5 text-center text-[13px] text-muted leading-tight transition-colors hover:border-line-soft has-[:checked]:border-empresas has-[:checked]:bg-empresas/8 has-[:checked]:text-ink"
                >
                  <input
                    type="radio"
                    name="paraPcd"
                    value={valor}
                    defaultChecked={modelo?.paraPcd === valor}
                    required
                    className="accent-empresas"
                  />
                  {rotulo}
                </label>
              ))}
            </div>
            {state.campos?.paraPcd && (
              <p className="mt-1.5 text-danger text-xs">
                {state.campos.paraPcd}
              </p>
            )}
          </fieldset>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <CampoCidade
              value={cidade}
              onChange={setCidade}
              error={state.campos?.cidade}
              label="Cidade da vaga"
            />
            {/*
              Texto livre e opcional, só informativo (#321): aparece no
              anúncio para quem decide se vai até lá, e não entra em filtro
              nem em ordem de nada.
            */}
            <Field
              label="Bairro"
              error={state.campos?.bairro}
              hint="Opcional. Aparece só no anúncio da vaga."
            >
              <Input
                name="bairro"
                maxLength={60}
                placeholder="Ex.: Centro"
                defaultValue={modelo?.bairro}
              />
            </Field>
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
              defaultValue={modelo?.endereco}
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
              placeholder="Ex.: colheitadeira, CNH D, manutenção básica"
              defaultValue={modelo?.habilidades}
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
                placeholder="Ex.: 1800"
                defaultValue={modelo?.salarioMin}
              />
            </Field>

            <Field label="Salário até (R$)" error={state.campos?.salarioMax}>
              <Input
                name="salarioMax"
                type="number"
                min={0}
                step={100}
                inputMode="numeric"
                placeholder="Ex.: 2200"
                defaultValue={modelo?.salarioMax}
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
              defaultValue={modelo?.descricao}
              required
              placeholder={
                "Atividades do dia a dia...\n\nRequisitos: ...\n\nOferecemos: vale-transporte, vale-refeição..."
              }
            />
          </Field>

          {/*
            Perguntas de triagem (#491): opcionais, até três, de sim ou não.
            "Eliminatória" separa quem responde Não numa lista à parte — não
            esconde nem barra ninguém, e a tela diz isso antes da empresa
            marcar.
          */}
          <fieldset>
            <legend className="mb-1 font-medium text-sm">
              Perguntas para quem se candidata{" "}
              <span className="font-normal text-faint">(opcional)</span>
            </legend>
            <p className="mb-3 text-faint text-xs leading-relaxed">
              Até 3 perguntas de sim ou não, como &ldquo;Tem CNH D?&rdquo;. Quem
              se candidata responde antes de enviar. Marque{" "}
              <strong>Eliminatória</strong> quando a resposta esperada é Sim:
              quem responder Não aparece separado na sua lista, mas ninguém é
              escondido nem barrado. Depois de publicada, a vaga não muda as
              perguntas.
            </p>
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <Input
                    name={`pergunta${n}`}
                    maxLength={120}
                    aria-label={`Pergunta ${n}`}
                    placeholder={
                      n === 1
                        ? "Ex.: Tem CNH categoria D?"
                        : "Ex.: Pode trabalhar à noite?"
                    }
                  />
                  <label className="flex min-h-11 items-center gap-2 text-muted text-sm">
                    <input
                      type="checkbox"
                      name={`eliminatoria${n}`}
                      aria-label={`Pergunta ${n} é eliminatória`}
                      className="accent-empresas"
                    />
                    Eliminatória
                  </label>
                </div>
              ))}
            </div>
            {(
              [
                state.campos?.pergunta1,
                state.campos?.pergunta2,
                state.campos?.pergunta3,
              ] as (string | undefined)[]
            )
              .filter(Boolean)
              .map((erro) => (
                <p key={erro} className="mt-1.5 text-danger text-xs">
                  {erro}
                </p>
              ))}
          </fieldset>

          {state.erro && (
            <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {state.erro}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-line border-t pt-5">
            <p className="text-faint text-xs">
              Você confere tudo antes de publicar.
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
