"use client";

import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface TrabalhoNaAba {
  id: string;
  titulo: string;
  corpo: string;
  imagemUrl: string | null;
}

/**
 * O perfil em duas abas: quem a pessoa é, e o que ela já fez.
 *
 * Desenho do Luiz. A razão de ser aba, e não uma seção a mais rolando para
 * baixo: no celular, o que decide a contratação são as fotos, e elas
 * ficavam embaixo de descrição, bairros e redes sociais — longe demais de
 * quem abriu o perfil para ver trabalho.
 *
 * Três por linha, como uma grade de fotos que todo mundo já sabe usar. O
 * toque abre a foto inteira com a legenda: a miniatura mostra que existe,
 * a legenda conta o que é.
 */
export function AbasDoPerfil({
  sobre,
  trabalhos,
  vazio,
  acoesDoDono,
}: {
  sobre: React.ReactNode;
  trabalhos: TrabalhoNaAba[];
  /** O que dizer quando não há foto nenhuma. Muda para dono e visitante. */
  vazio: React.ReactNode;
  /** Só para o dono: adicionar e remover, dentro da própria aba. */
  acoesDoDono?: React.ReactNode;
}) {
  const [aba, setAba] = useState<"sobre" | "servicos">("sobre");
  const [aberta, setAberta] = useState<TrabalhoNaAba | null>(null);

  return (
    <>
      <div
        role="tablist"
        aria-label="Seções do perfil"
        className="mt-5 flex border-line border-b"
      >
        {(
          [
            ["sobre", "Sobre mim"],
            ["servicos", "Serviços"],
          ] as const
        ).map(([chave, rotulo]) => (
          <button
            key={chave}
            type="button"
            role="tab"
            id={`aba-${chave}`}
            aria-selected={aba === chave}
            aria-controls={`painel-${chave}`}
            onClick={() => setAba(chave)}
            className={cn(
              "-mb-px border-b-2 px-5 py-3 font-medium text-sm transition-colors",
              aba === chave
                ? "border-servicos text-servicos"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="painel-sobre"
        aria-labelledby="aba-sobre"
        hidden={aba !== "sobre"}
      >
        {sobre}
      </div>

      <div
        role="tabpanel"
        id="painel-servicos"
        aria-labelledby="aba-servicos"
        hidden={aba !== "servicos"}
        className="pt-5"
      >
        {acoesDoDono}

        {trabalhos.length === 0 ? (
          <div className="py-8 text-center text-muted text-sm">{vazio}</div>
        ) : (
          <ul className="grid grid-cols-3 gap-1.5">
            {trabalhos.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setAberta(t)}
                  className="block w-full overflow-hidden rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-servicos"
                >
                  {t.imagemUrl ? (
                    <span className="relative block aspect-square w-full">
                      <Image
                        src={t.imagemUrl}
                        alt={t.titulo}
                        fill
                        /*
                         * Três colunas no celular, e a grade não passa de
                         * `max-w-lg` no desktop — daí o teto fixo. Sem
                         * `sizes` o Next assume tela cheia e baixa uma
                         * imagem grande demais para uma miniatura.
                         */
                        sizes="(max-width: 640px) 33vw, 176px"
                        className="object-cover transition-opacity hover:opacity-85"
                      />
                    </span>
                  ) : (
                    <span className="flex aspect-square w-full items-center justify-center bg-panel-2 p-2 text-center text-[11px] text-muted">
                      {t.titulo}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {aberta && <Ampliada trabalho={aberta} fechar={() => setAberta(null)} />}
    </>
  );
}

/**
 * A foto inteira, com a legenda.
 *
 * A miniatura mostra que o trabalho existe; a legenda é o que explica o
 * que foi feito. Sem ela, a grade vira álbum sem contexto — e o texto é
 * justamente o que diferencia um encanador de outro.
 */
function Ampliada({
  trabalho,
  fechar,
}: {
  trabalho: TrabalhoNaAba;
  fechar: () => void;
}) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    document.addEventListener("keydown", aoTeclar);
    // Fundo travado: rolar a lista por trás do que se está olhando confunde.
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = antes;
    };
  }, [fechar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={trabalho.titulo}
    >
      {/* Clicar fora fecha — o gesto que todo mundo já tenta primeiro. */}
      <button
        type="button"
        aria-label="Fechar"
        onClick={fechar}
        className="absolute inset-0 cursor-default"
      />

      <div className="relative max-h-full w-full max-w-lg overflow-y-auto rounded-[var(--radius-card)] bg-panel">
        <button
          type="button"
          onClick={fechar}
          aria-label="Fechar"
          className="absolute top-3 right-3 rounded-full bg-bg/70 p-2 text-ink hover:bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-servicos"
        >
          <X size={18} />
        </button>

        {trabalho.imagemUrl && (
          /*
           * Aqui a proporção é a da foto, que só se sabe ao carregar:
           * `width`/`height` dão a relação para reservar o espaço, e
           * `h-auto` devolve a proporção real quando ela chega. Sem isso a
           * legenda pula para baixo no meio da leitura.
           */
          <Image
            src={trabalho.imagemUrl}
            alt={trabalho.titulo}
            width={1024}
            height={1024}
            sizes="(max-width: 640px) 100vw, 512px"
            className="h-auto w-full object-contain"
          />
        )}

        <div className="p-5">
          <h2 className="font-bold text-base">{trabalho.titulo}</h2>
          <p className="mt-1.5 whitespace-pre-line text-muted text-sm leading-relaxed">
            {trabalho.corpo}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Adicionar e remover, dentro da própria aba.
 *
 * O atalho "Meus trabalhos" no perfil levava a uma tela separada para
 * fazer isto. Uma tela a mais entre a pessoa e a foto do trabalho dela é
 * uma tela a mais para desistir — e ela já está olhando exatamente para o
 * lugar onde a foto vai aparecer.
 */
export function GerenciarTrabalhos({
  trabalhos,
  restantes,
  limite,
  publicar,
  arquivar,
}: {
  trabalhos: TrabalhoNaAba[];
  restantes: number;
  limite: number;
  publicar: (
    anterior: { erro?: string; ok?: boolean },
    dados: FormData,
  ) => Promise<{ erro?: string; ok?: boolean }>;
  arquivar: (id: string) => Promise<void>;
}) {
  const [estado, acao, pendente] = useActionState(publicar, {});
  const [abrindo, setAbrindo] = useState(false);

  /*
   * Fecha o formulário quando o envio deu certo, ajustando durante a
   * renderização em vez de num efeito.
   *
   * `useEffect` para sincronizar estado com estado é o que o próprio React
   * desaconselha, e o lint recusa: dispara uma renderização em cascata
   * depois da que já aconteceu. Comparar com o último resultado visto faz
   * o mesmo trabalho numa passada só.
   */
  const [ultimoOk, setUltimoOk] = useState(false);
  const okAgora = Boolean(estado.ok);
  if (okAgora !== ultimoOk) {
    setUltimoOk(okAgora);
    if (okAgora) setAbrindo(false);
  }

  return (
    <div className="mb-5">
      {!abrindo ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted text-sm">
            {restantes > 0
              ? `${restantes} de ${limite} espaços livres.`
              : `Você chegou aos ${limite}. Remova um para publicar outro.`}
          </p>
          <Button
            type="button"
            variant="servicos"
            size="sm"
            disabled={restantes === 0}
            onClick={() => setAbrindo(true)}
          >
            <ImagePlus size={16} />
            Adicionar trabalho
          </Button>
        </div>
      ) : (
        <form action={acao}>
          <Panel className="space-y-4">
            <div>
              <label htmlFor="t-titulo" className="font-medium text-sm">
                O que é este trabalho
              </label>
              <input
                id="t-titulo"
                name="titulo"
                required
                maxLength={80}
                placeholder="Quadro de disjuntores trocado"
                className="mt-1.5 w-full rounded-xl border border-line bg-panel-2 px-4 py-2.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="t-corpo" className="font-medium text-sm">
                Legenda
              </label>
              <textarea
                id="t-corpo"
                name="corpo"
                required
                rows={3}
                maxLength={600}
                placeholder="Troca completa no Jardim Botânico, com disjuntores DR."
                className="mt-1.5 w-full rounded-xl border border-line bg-panel-2 px-4 py-2.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="t-foto" className="font-medium text-sm">
                Foto
              </label>
              <input
                id="t-foto"
                name="imagem"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="mt-1.5 w-full text-muted text-sm"
              />
            </div>

            {estado.erro && (
              <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-danger text-sm">
                {estado.erro}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAbrindo(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="servicos"
                size="sm"
                disabled={pendente}
              >
                {pendente && <Loader2 size={15} className="animate-spin" />}
                Publicar
              </Button>
            </div>
          </Panel>
        </form>
      )}

      {trabalhos.length > 0 && (
        <ul className="mt-4 space-y-2">
          {trabalhos.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm">
                {t.titulo}
              </span>
              <form action={arquivar.bind(null, t.id)}>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  aria-label={`Remover ${t.titulo}`}
                >
                  <Trash2 size={15} />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
