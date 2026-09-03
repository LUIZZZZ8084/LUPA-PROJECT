"use client";

import { ImagePlus, Loader2, Pencil, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * O que o dono pode fazer com a própria publicação, de dentro da foto.
 *
 * As duas chegam prontas da página, envelopadas por `criarAcao`. O
 * componente não sabe se há banco atrás — só que uma devolve erro de campo
 * e a outra não devolve nada.
 */
export interface AcoesDoDono {
  editar: (
    anterior: { erro?: string; ok?: boolean },
    dados: FormData,
  ) => Promise<{ erro?: string; ok?: boolean }>;
  excluir: (id: string) => Promise<void>;
}

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
  dono,
}: {
  sobre: React.ReactNode;
  trabalhos: TrabalhoNaAba[];
  /** O que dizer quando não há foto nenhuma. Muda para dono e visitante. */
  vazio: React.ReactNode;
  /** Só para o dono: o contador e o botão de adicionar, acima da grade. */
  acoesDoDono?: React.ReactNode;
  /**
   * Editar e excluir, quando quem olha é o dono.
   *
   * Elas moram dentro da foto ampliada, e não numa lista abaixo da grade.
   * A lista veio da tela antiga `/perfil/publicacoes`, onde fazia sentido
   * porque não havia grade nenhuma; trazida para cá, virou o mesmo item
   * desenhado duas vezes — uma delas sem foto. Decisão do Luiz em
   * 03/09/2026, olhando para o resultado: as ações vão para onde a pessoa
   * já está olhando quando decide mexer.
   */
  dono?: AcoesDoDono;
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

      {aberta && (
        <Ampliada
          trabalho={aberta}
          dono={dono}
          fechar={() => setAberta(null)}
        />
      )}
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
  dono,
  fechar,
}: {
  trabalho: TrabalhoNaAba;
  dono?: AcoesDoDono;
  fechar: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, iniciarExclusao] = useTransition();

  /*
   * O excluir chama a server action e fecha o card em seguida.
   *
   * Um `<form action={excluir.bind(...)}>` puro deixava o card aberto
   * depois de "Tirar do perfil": o item saía da grade por trás — o
   * contador de espaços já mostrava o novo número —, mas este componente
   * guarda `trabalho` no estado do pai, que não é recalculado por uma
   * revalidação. Chamar `fechar()` explicitamente depois do `await` é o
   * que fecha a mesma janela que a lista já reflete.
   */
  function excluir() {
    if (!dono) return;
    iniciarExclusao(async () => {
      await dono.excluir(trabalho.id);
      fechar();
    });
  }

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      /*
       * Escape sai da edição antes de sair do card. Fechar tudo de uma vez
       * levaria embora o texto que a pessoa acabou de digitar, num gesto
       * que ela fez esperando desfazer só o último passo.
       */
      if (editando) return setEditando(false);
      if (confirmando) return setConfirmando(false);
      fechar();
    };
    document.addEventListener("keydown", aoTeclar);
    // Fundo travado: rolar a lista por trás do que se está olhando confunde.
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = antes;
    };
  }, [fechar, editando, confirmando]);

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
          {editando && dono ? (
            <FormularioDeEdicao
              trabalho={trabalho}
              editar={dono.editar}
              cancelar={() => setEditando(false)}
              pronto={fechar}
            />
          ) : (
            <>
              <h2 className="font-bold text-base">{trabalho.titulo}</h2>
              <p className="mt-1.5 whitespace-pre-line text-muted text-sm leading-relaxed">
                {trabalho.corpo}
              </p>

              {dono && (
                <div className="mt-5 border-line border-t pt-4">
                  {confirmando ? (
                    /*
                     * Um passo antes de tirar do ar. "Remover" arquiva, não
                     * apaga — e é justamente por isso que a frase diz o que
                     * acontece: sem ela, a pessoa hesita achando que vai
                     * perder o registro de um trabalho que ela fez.
                     */
                    <div>
                      <p className="text-muted text-sm leading-relaxed">
                        Tirar este trabalho do seu perfil? Ele sai da grade e
                        libera um espaço — nada é apagado.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmando(false)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          disabled={excluindo}
                          onClick={excluir}
                        >
                          {excluindo && (
                            <Loader2 size={15} className="animate-spin" />
                          )}
                          Tirar do perfil
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditando(true)}
                      >
                        <Pencil size={15} />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmando(true)}
                      >
                        <Trash2 size={15} />
                        Remover
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Corrigir o texto, e trocar a foto se for o caso.
 *
 * A foto é opcional de propósito: o motivo comum de abrir isto é arrumar
 * uma palavra da legenda, e obrigar a reenviar a imagem por causa disso
 * seria caro em dado móvel contado.
 *
 * Ao dar certo, o card fecha. A action revalida a rota, e a revalidação
 * troca a lista embaixo do card — deixá-lo aberto mostraria o texto velho
 * de um item que já mudou. É a mesma armadilha que já derrubou a
 * confirmação da avaliação neste projeto.
 */
function FormularioDeEdicao({
  trabalho,
  editar,
  cancelar,
  pronto,
}: {
  trabalho: TrabalhoNaAba;
  editar: AcoesDoDono["editar"];
  cancelar: () => void;
  pronto: () => void;
}) {
  const [estado, acao, pendente] = useActionState(editar, {});

  const [ultimoOk, setUltimoOk] = useState(false);
  const okAgora = Boolean(estado.ok);
  if (okAgora !== ultimoOk) {
    setUltimoOk(okAgora);
    if (okAgora) pronto();
  }

  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="id" value={trabalho.id} />

      <div>
        <label htmlFor="e-titulo" className="font-medium text-sm">
          O que é este trabalho
        </label>
        <input
          id="e-titulo"
          name="titulo"
          required
          maxLength={80}
          defaultValue={trabalho.titulo}
          className="mt-1.5 w-full rounded-xl border border-line bg-panel-2 px-4 py-2.5 text-sm"
        />
      </div>

      <div>
        <label htmlFor="e-corpo" className="font-medium text-sm">
          Legenda
        </label>
        <textarea
          id="e-corpo"
          name="corpo"
          required
          rows={3}
          maxLength={600}
          defaultValue={trabalho.corpo}
          className="mt-1.5 w-full rounded-xl border border-line bg-panel-2 px-4 py-2.5 text-sm"
        />
      </div>

      <div>
        <label htmlFor="e-foto" className="font-medium text-sm">
          Trocar a foto
        </label>
        <p className="mt-0.5 text-faint text-xs">
          Deixe em branco para manter a que já está aqui.
        </p>
        <input
          id="e-foto"
          name="foto"
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
        <Button type="button" variant="outline" size="sm" onClick={cancelar}>
          Cancelar
        </Button>
        <Button type="submit" variant="servicos" size="sm" disabled={pendente}>
          {pendente && <Loader2 size={15} className="animate-spin" />}
          Salvar
        </Button>
      </div>
    </form>
  );
}

/**
 * Adicionar, acima da grade.
 *
 * O atalho "Meus trabalhos" no perfil levava a uma tela separada para
 * fazer isto. Uma tela a mais entre a pessoa e a foto do trabalho dela é
 * uma tela a mais para desistir — e ela já está olhando exatamente para o
 * lugar onde a foto vai aparecer.
 *
 * Editar e remover **não** estão aqui: eles moram dentro da foto ampliada.
 * Uma lista de títulos abaixo da grade desenhava o mesmo item duas vezes,
 * e a segunda vez sem foto.
 */
export function GerenciarTrabalhos({
  restantes,
  limite,
  publicar,
}: {
  restantes: number;
  limite: number;
  publicar: (
    anterior: { erro?: string; ok?: boolean },
    dados: FormData,
  ) => Promise<{ erro?: string; ok?: boolean }>;
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
    </div>
  );
}
