"use client";

import { AlertTriangle, Camera, Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SERVICE_CATEGORIES } from "@/lib/constants";
import { ativarPrestadorComEstado, type EstadoAtivacao } from "./actions";

const inicial: EstadoAtivacao = {};

/**
 * O aviso vem antes do formulário, e é a condição da decisão.
 *
 * O Luiz escolheu que virar prestador **troca** o papel: a pessoa deixa de
 * poder se candidatar a vagas. Foi escolha consciente do trade-off, e com
 * uma exigência junto — que ela seja avisada. Um aviso depois do botão, ou
 * escondido num parágrafo cinza, não é aviso: é registro para quem for
 * reclamar depois.
 */
function AvisoDaTroca() {
  return (
    <Panel className="mb-5 border-warn/30 bg-warn/8">
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="mt-0.5 flex-none text-warn" />
        <div>
          <h2 className="font-bold text-base">
            Ao virar prestador, você deixa de se candidatar a vagas
          </h2>
          <ul className="mt-2 space-y-1.5 text-muted text-sm leading-relaxed">
            <li>
              Sua conta passa a ser de <strong>prestador de serviço</strong> — o
              botão de candidatar-se some das vagas.
            </li>
            <li>
              As candidaturas que você já enviou{" "}
              <strong>continuam visíveis</strong> em &ldquo;Minhas
              candidaturas&rdquo;. O que acaba é enviar novas.
            </li>
            <li>
              Voltar a ser candidato depois é caso de suporte, não um botão — a
              troca não se desfaz sozinha.
            </li>
          </ul>
        </div>
      </div>
    </Panel>
  );
}

/**
 * Sem foto não dá para ativar — mas só onde é possível ter foto.
 *
 * O envio de arquivo depende do Storage, que não existe em modo
 * demonstração. Bloquear ali deixaria o fluxo inteiro inalcançável para
 * quem está conhecendo o produto; por isso a exigência vem calculada do
 * servidor, e não de um `required` no input.
 */
function FaltaFoto() {
  return (
    <Panel className="border-servicos/30">
      <div className="flex items-start gap-3">
        <Camera size={20} className="mt-0.5 flex-none text-servicos" />
        <div>
          <h2 className="font-bold text-base">Falta a sua foto de perfil</h2>
          <p className="mt-1.5 text-muted text-sm leading-relaxed">
            Quem contrata alguém para entrar em casa decide olhando para o
            rosto. A foto é obrigatória para oferecer serviço.
          </p>
          <ButtonLink
            href="/perfil/editar"
            variant="servicos"
            size="sm"
            className="mt-4"
          >
            Enviar foto agora
          </ButtonLink>
        </div>
      </div>
    </Panel>
  );
}

export function AtivarPrestadorForm({
  precisaDeFoto,
  bairro,
}: {
  precisaDeFoto: boolean;
  bairro: string | null;
}) {
  const [state, action, pendente] = useActionState(
    ativarPrestadorComEstado,
    inicial,
  );
  /*
   * Não há navegação no cliente aqui de propósito.
   *
   * A action revalida o layout — o papel decide o menu inteiro —, e isso
   * re-renderiza esta rota no servidor, onde a página manda quem já é
   * prestador para `/perfil`. Um `router.replace` junto disputaria a
   * mesma navegação, e foi assim que a primeira versão deixou quem
   * acabava de ativar olhando para um 404.
   */

  if (precisaDeFoto) return <FaltaFoto />;

  return (
    <>
      <AvisoDaTroca />

      <form action={action}>
        <Panel className="space-y-5">
          <Field
            label="CPF"
            required
            error={state.campos?.cpf}
            hint="É o que amarra o anúncio a uma pessoa real. Não aparece no seu perfil público."
          >
            <Input
              name="cpf"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              required
            />
          </Field>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field
              label="Categoria do serviço"
              required
              error={state.campos?.categoriaId}
            >
              <Select name="categoriaId" defaultValue="" required>
                <option value="" disabled>
                  Escolha uma categoria
                </option>
                {SERVICE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Preço a partir de (R$)"
              error={state.campos?.precoInicial}
              hint="Opcional. Perfis com preço recebem mais contato."
            >
              <Input
                name="precoInicial"
                type="number"
                min={0}
                step={10}
                inputMode="numeric"
                placeholder="150"
              />
            </Field>
          </div>

          <Field
            label="Sobre o seu trabalho"
            required
            error={state.campos?.descricao}
            hint="O que você faz, onde atende e o que te diferencia."
          >
            <Textarea
              name="descricao"
              rows={5}
              required
              placeholder="Trabalho com instalações elétricas residenciais e comerciais, manutenção e reparos em geral. Atendo Sinop e região."
            />
          </Field>

          {bairro && (
            <p className="text-faint text-xs leading-relaxed">
              Seu perfil nasce atendendo o {bairro}. Você acrescenta outros
              bairros depois, em Editar perfil.
            </p>
          )}

          {state.erro && (
            <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-danger text-sm">
              {state.erro}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-line border-t pt-5">
            <Link
              href="/perfil"
              className="text-muted text-xs underline hover:text-ink"
            >
              Agora não
            </Link>
            <Button type="submit" variant="servicos" disabled={pendente}>
              {pendente && <Loader2 size={16} className="animate-spin" />}
              Virar prestador
            </Button>
          </div>
        </Panel>
      </form>
    </>
  );
}
