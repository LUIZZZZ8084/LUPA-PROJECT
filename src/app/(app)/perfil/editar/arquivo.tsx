"use client";

import { Check, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import type { EstadoEdicao } from "./actions";

const inicial: EstadoEdicao = {};

type PonteDeEnvio = (
  anterior: EstadoEdicao,
  formData: FormData,
) => Promise<EstadoEdicao>;

/**
 * Envio de arquivo, com o estado atual à vista.
 *
 * Um seletor de arquivo sozinho não diz o que já existe. Mostrar o que está
 * lá hoje é o que permite à pessoa decidir se precisa trocar — e é o único
 * jeito de ela perceber que o envio anterior não funcionou.
 */
export function CampoDeArquivo({
  titulo,
  descricao,
  formatos,
  accept,
  enviar,
  remover,
  disponivel,
  children,
}: {
  titulo: string;
  descricao: string;
  /** O limite dito em palavras, porque o `accept` não é visível. */
  formatos: string;
  accept: string;
  enviar: PonteDeEnvio;
  remover: () => Promise<unknown>;
  /**
   * Sem Supabase não há Storage. Dizer isso é melhor do que aceitar o
   * envio e perder o arquivo — a pessoa acharia que salvou.
   */
  disponivel: boolean;
  /** A prévia do que já está gravado. */
  children: React.ReactNode;
}) {
  const [estado, acao, enviando] = useActionState(enviar, inicial);
  const [removendo, iniciarRemocao] = useTransition();
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);

  return (
    <Panel className="mb-5 space-y-4">
      <div>
        <h2 className="font-bold text-lg">{titulo}</h2>
        <p className="mt-1 text-muted text-sm leading-relaxed">{descricao}</p>
      </div>

      <div className="flex items-center gap-4">{children}</div>

      {disponivel ? (
        <form action={acao} className="space-y-3">
          <input
            ref={entrada}
            type="file"
            name="arquivo"
            accept={accept}
            required
            aria-label={titulo}
            className="block w-full text-muted text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-panel-2 file:px-3 file:py-2 file:font-medium file:text-ink file:text-sm hover:file:bg-line"
          />
          <p className="text-faint text-xs">{formatos}</p>

          {estado.erro && (
            <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-danger text-sm">
              {estado.erro}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={enviando}
            >
              {enviando ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Upload size={15} />
              )}
              Enviar
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={removendo}
              onClick={() =>
                iniciarRemocao(async () => {
                  await remover();
                  if (entrada.current) entrada.current.value = "";
                  // A prévia vem do servidor; sem isto ela fica na tela.
                  router.refresh();
                })
              }
            >
              <Trash2 size={15} />
              {removendo ? "Removendo…" : "Remover"}
            </Button>

            {estado.ok && !enviando && (
              <span className="inline-flex items-center gap-1.5 text-sm text-vagas">
                <Check size={16} />
                Enviado
              </span>
            )}
          </div>
        </form>
      ) : (
        <p className="rounded-xl border border-line bg-panel-2 px-4 py-3 text-muted text-sm leading-relaxed">
          O envio de arquivos precisa do banco configurado. Nesta demonstração,
          o resto do perfil funciona normalmente.
        </p>
      )}
    </Panel>
  );
}

/** Prévia de imagem: a foto atual, ou as iniciais quando não há. */
export function PreviaDeImagem({
  url,
  nome,
}: {
  url: string | null;
  nome: string;
}) {
  return (
    <>
      <Avatar src={url} name={nome} size="lg" />
      <span className="text-muted text-sm">
        {url ? "Imagem atual" : "Nenhuma imagem enviada"}
      </span>
    </>
  );
}

/**
 * Prévia do currículo.
 *
 * O link é assinado e expira em pouco tempo — o arquivo mora em bucket
 * privado. Por isso ele abre em aba nova em vez de virar um `download`:
 * uma URL que morre em um minuto não deve ser guardada em lugar nenhum.
 */
export function PreviaDeCurriculo({ link }: { link: string | null }) {
  if (!link) {
    return <span className="text-muted text-sm">Nenhum currículo enviado</span>;
  }

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-sm text-vagas hover:underline"
    >
      <FileText size={16} />
      Ver o currículo enviado
    </a>
  );
}
