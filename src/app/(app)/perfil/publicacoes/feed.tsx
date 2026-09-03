"use client";

import { ImagePlus, Loader2, RotateCcw, Trash2 } from "lucide-react";
import Image from "next/image";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import type { Publicacao } from "@/server/publicacoes/tipos";
import {
  arquivarComEstado,
  type EstadoPublicacao,
  publicarComFotoComEstado,
  reativarComEstado,
} from "./actions";

const inicial: EstadoPublicacao = {};

/**
 * Publicar um trabalho: uma foto e o que foi feito.
 *
 * A foto é `required` na tela quando há Storage, e ausente quando não há —
 * o modo demonstração não tem onde guardar arquivo, e travar ali deixaria
 * o feed impossível de mostrar a quem está conhecendo o produto.
 */
function FormularioNovo({
  temArmazenamento,
  cheio,
}: {
  temArmazenamento: boolean;
  cheio: boolean;
}) {
  const [state, action, pendente] = useActionState(
    publicarComFotoComEstado,
    inicial,
  );

  if (cheio) {
    return (
      <Panel className="mb-6 border-warn/30 bg-warn/8">
        <h2 className="font-bold text-base">Seu feed está cheio</h2>
        <p className="mt-1.5 text-muted text-sm leading-relaxed">
          Remova um trabalho abaixo para publicar outro. Nada é apagado — o que
          sai do feed volta quando você quiser.
        </p>
      </Panel>
    );
  }

  return (
    <form action={action} className="mb-8">
      <Panel className="space-y-5">
        <div>
          <h2 className="font-bold text-base">Publicar um trabalho</h2>
          <p className="mt-1 text-muted text-sm leading-relaxed">
            Uma foto do serviço pronto e uma descrição curta do que foi feito.
          </p>
        </div>

        <Field
          label="Foto do trabalho"
          required={temArmazenamento}
          error={state.campos?.foto ?? state.campos?.arquivo}
          hint={
            temArmazenamento
              ? "JPG, PNG ou WEBP, até 2 MB."
              : "O envio de imagem precisa do Supabase configurado. Sem ele, o trabalho é publicado só com o texto."
          }
        >
          <Input
            name="foto"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required={temArmazenamento}
            disabled={!temArmazenamento}
          />
        </Field>

        <Field
          label="O que foi feito"
          required
          error={state.campos?.titulo}
          hint="Ex.: Instalação de chuveiro e disjuntor"
        >
          <Input name="titulo" required placeholder="Instalação elétrica" />
        </Field>

        <Field
          label="Detalhes"
          required
          error={state.campos?.corpo}
          hint="Onde foi, o que o serviço envolveu, quanto tempo levou."
        >
          <Textarea
            name="corpo"
            rows={4}
            required
            placeholder="Troca do quadro de disjuntores num sobrado no Jardim Botânico. Instalei DR e refiz a fiação da cozinha. Um dia de serviço."
          />
        </Field>

        {state.erro && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-danger text-sm">
            {state.erro}
          </p>
        )}

        <div className="flex justify-end border-line border-t pt-5">
          <Button type="submit" variant="servicos" disabled={pendente}>
            {pendente ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ImagePlus size={16} />
            )}
            Publicar trabalho
          </Button>
        </div>
      </Panel>
    </form>
  );
}

/**
 * Tirar do feed é arquivar, não apagar.
 *
 * O texto diz "remover" porque é o que a pessoa quer fazer; por baixo, o
 * registro fica. Apagar de verdade tiraria dela um trabalho que ela teve —
 * e o botão de voltar existe logo ao lado, no que já saiu.
 */
function BotaoDeStatus({ id, arquivada }: { id: string; arquivada: boolean }) {
  const [, action, pendente] = useActionState(
    arquivada ? reativarComEstado : arquivarComEstado,
    inicial,
  );

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pendente}
        aria-label={arquivada ? "Colocar de volta no feed" : "Remover do feed"}
      >
        {pendente ? (
          <Loader2 size={14} className="animate-spin" />
        ) : arquivada ? (
          <RotateCcw size={14} />
        ) : (
          <Trash2 size={14} />
        )}
        {arquivada ? "Voltar ao feed" : "Remover"}
      </Button>
    </form>
  );
}

function Cartao({ publicacao }: { publicacao: Publicacao }) {
  const arquivada = publicacao.status === "arquivada";

  return (
    <Panel className={arquivada ? "opacity-70" : undefined}>
      <div className="flex flex-col gap-4 sm:flex-row">
        {publicacao.imagemUrl ? (
          <span className="relative block h-32 w-full flex-none overflow-hidden rounded-xl sm:w-40">
            <Image
              src={publicacao.imagemUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 160px"
              className="object-cover"
            />
          </span>
        ) : (
          <div className="flex h-32 w-full flex-none items-center justify-center rounded-xl bg-panel-2 text-faint sm:w-40">
            <ImagePlus size={22} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-bold text-base">{publicacao.titulo}</h3>
            {arquivada && (
              <span className="flex-none rounded-full bg-panel-2 px-2.5 py-1 text-faint text-xs">
                Fora do feed
              </span>
            )}
          </div>
          <p className="mt-1.5 whitespace-pre-line text-muted text-sm leading-relaxed">
            {publicacao.corpo}
          </p>
          <div className="mt-3">
            <BotaoDeStatus id={publicacao.id} arquivada={arquivada} />
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function FeedDoPrestador({
  publicacoes,
  ativas,
  limite,
  temArmazenamento,
}: {
  publicacoes: Publicacao[];
  ativas: number;
  limite: number;
  temArmazenamento: boolean;
}) {
  const noFeed = publicacoes.filter((p) => p.status === "ativa");
  const foraDoFeed = publicacoes.filter((p) => p.status === "arquivada");

  return (
    <>
      <p className="mb-5 font-mono text-faint text-xs">
        {ativas} de {limite} no feed
      </p>

      <FormularioNovo
        temArmazenamento={temArmazenamento}
        cheio={ativas >= limite}
      />

      {noFeed.length === 0 && foraDoFeed.length === 0 ? (
        <Panel className="text-center">
          <p className="text-muted text-sm leading-relaxed">
            Você ainda não publicou nenhum trabalho. Quem procura um
            profissional decide olhando o que ele já fez.
          </p>
        </Panel>
      ) : (
        <div className="space-y-3">
          {noFeed.map((p) => (
            <Cartao key={p.id} publicacao={p} />
          ))}
        </div>
      )}

      {foraDoFeed.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 font-bold text-base">Fora do feed</h2>
          <div className="space-y-3">
            {foraDoFeed.map((p) => (
              <Cartao key={p.id} publicacao={p} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
