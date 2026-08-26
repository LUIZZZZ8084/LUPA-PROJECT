"use client";

import { Check, Loader2 } from "lucide-react";
import { useActionState, useId } from "react";
import {
  CampoBairro,
  CampoBairrosAtendidos,
} from "@/components/cidade-e-bairro";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { JOB_CATEGORIES, SERVICE_CATEGORIES } from "@/lib/constants";
import type { PerfilCompleto } from "@/server/perfil/servico";
import {
  type EstadoEdicao,
  enviarCurriculoComEstado,
  enviarFotoComEstado,
  enviarLogoComEstado,
  removerCurriculo,
  removerFoto,
  removerLogo,
  salvarAnuncioComEstado,
  salvarContaComEstado,
  salvarCurriculoComEstado,
  salvarEmpresaComEstado,
} from "./actions";
import { CampoDeArquivo, PreviaDeCurriculo, PreviaDeImagem } from "./arquivo";

const inicial: EstadoEdicao = {};

/**
 * Um formulário por assunto, cada um com o próprio botão.
 *
 * Um formulário só, com tudo, obrigaria a pessoa a reenviar o currículo
 * inteiro para corrigir o telefone — e um erro em qualquer campo bloquearia
 * o salvamento de todos. Em conexão ruim, que é o caso de boa parte do
 * público, isso é a diferença entre corrigir e desistir.
 */
function Secao({
  titulo,
  descricao,
  estado,
  pendente,
  children,
}: {
  titulo: string;
  descricao: string;
  estado: EstadoEdicao;
  pendente: boolean;
  children: React.ReactNode;
}) {
  return (
    <Panel className="mb-5 space-y-5">
      <div>
        <h2 className="font-bold text-lg">{titulo}</h2>
        <p className="mt-1 text-muted text-sm leading-relaxed">{descricao}</p>
      </div>

      {children}

      {estado.erro && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-danger text-sm">
          {estado.erro}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="vagas" disabled={pendente}>
          {pendente && <Loader2 size={16} className="animate-spin" />}
          Salvar
        </Button>
        {/*
         * A confirmação fica ao lado do botão, e não num aviso que some.
         * Quem salva precisa saber que salvou sem depender de ter olhado
         * no instante certo.
         */}
        {estado.ok && !pendente && (
          <span className="inline-flex items-center gap-1.5 text-sm text-vagas">
            <Check size={16} />
            Salvo
          </span>
        )}
      </div>
    </Panel>
  );
}

function Conta({ perfil }: { perfil: PerfilCompleto }) {
  const [estado, acao, pendente] = useActionState(
    salvarContaComEstado,
    inicial,
  );
  const u = perfil.usuario;

  return (
    <form action={acao}>
      <Secao
        titulo="Sua conta"
        descricao="Nome e telefone aparecem para quem entra em contato com você."
        estado={estado}
        pendente={pendente}
      >
        <Field
          label="Nome completo"
          required
          error={estado.campos?.nomeCompleto}
        >
          <Input name="nomeCompleto" defaultValue={u.nomeCompleto} required />
        </Field>

        <Field
          label="WhatsApp"
          required
          hint="É por onde as pessoas vão falar com você."
          error={estado.campos?.telefone}
        >
          <Input
            name="telefone"
            type="tel"
            defaultValue={u.telefone}
            required
          />
        </Field>

        {/*
          A cidade não se edita aqui, de propósito. Mudar de cidade muda
          quem encontra a pessoa e onde os anúncios dela aparecem — é
          mudança de contexto inteiro, não correção de campo. Enquanto não
          houver essa tela, é caso de suporte, com gente olhando.
        */}
        <CampoBairro
          cidade={u.cidade}
          defaultValue={u.bairro}
          error={estado.campos?.bairro}
        />
      </Secao>
    </form>
  );
}

/**
 * A opção de ser encontrado, com o que ela significa ao lado.
 *
 * O rótulo é curto e a explicação vai em `aria-describedby`. Envolver a
 * caixa num `<label>` com o parágrafo inteiro dentro faz o nome acessível
 * dela virar o texto todo: quem usa leitor de tela ouve quatro linhas
 * antes de saber o que é o controle, e `getByLabel("Habilidades")` passa
 * a casar aqui por causa de uma palavra no meio da explicação — foi assim
 * que um teste de outra tela quebrou.
 */
function VisivelParaEmpresas({ ligado }: { ligado: boolean }) {
  const id = useId();
  const idExplicacao = `${id}-explicacao`;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-panel-2 p-4">
      <input
        id={id}
        type="checkbox"
        name="visivelParaEmpresas"
        defaultChecked={ligado}
        aria-describedby={idExplicacao}
        className="mt-0.5 h-4 w-4 flex-none rounded border-line bg-panel accent-vagas"
      />
      <div className="text-sm">
        <label htmlFor={id} className="font-semibold">
          Quero que empresas me encontrem
        </label>
        <p
          id={idExplicacao}
          className="mt-1 text-[11px] leading-relaxed text-muted"
        >
          Empresas com vaga aberta passam a ver seu nome, sua cidade, suas
          habilidades e seu contato — mesmo sem você se candidatar. Seu
          currículo continua privado: só vai para as vagas em que você se
          candidatar. Pode desmarcar quando quiser.
        </p>
      </div>
    </div>
  );
}

function Curriculo({ perfil }: { perfil: PerfilCompleto }) {
  const [estado, acao, pendente] = useActionState(
    salvarCurriculoComEstado,
    inicial,
  );
  const c = perfil.candidato;

  return (
    <form action={acao}>
      <Secao
        titulo="Currículo"
        descricao="É o que a empresa lê ao receber sua candidatura. Não aparece em busca pública."
        estado={estado}
        pendente={pendente}
      >
        <Field label="Área desejada" error={estado.campos?.areaDesejada}>
          <Select name="areaDesejada" defaultValue={c?.areaDesejada ?? ""}>
            <option value="">Não informar</option>
            {JOB_CATEGORIES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Resumo"
          hint="Duas ou três linhas sobre o que você já fez."
          error={estado.campos?.resumo}
        >
          <Textarea name="resumo" rows={4} defaultValue={c?.resumo ?? ""} />
        </Field>

        <Field label="Formação" error={estado.campos?.formacao}>
          <Input
            name="formacao"
            defaultValue={c?.formacao ?? ""}
            placeholder="Ensino médio completo"
          />
        </Field>

        <Field
          label="Habilidades"
          hint="Separe por vírgula. Ex.: CNH categoria C, empilhadeira"
          error={estado.campos?.habilidades}
        >
          <Input
            name="habilidades"
            defaultValue={(c?.habilidades ?? []).join(", ")}
          />
        </Field>

        {/*
          A opção de ser encontrado, com o que ela significa escrito ao
          lado. Uma caixa chamada "visível para empresas" sem explicação
          faz a pessoa marcar sem saber o que entregou — e isto entrega o
          telefone dela para empresas que ela não escolheu.
        */}
        <VisivelParaEmpresas ligado={c?.visivelParaEmpresas ?? false} />

        <Field label="Disponibilidade" error={estado.campos?.disponibilidade}>
          <Input
            name="disponibilidade"
            defaultValue={c?.disponibilidade ?? ""}
            placeholder="Imediata"
          />
        </Field>
      </Secao>
    </form>
  );
}

function Anuncio({ perfil }: { perfil: PerfilCompleto }) {
  const [estado, acao, pendente] = useActionState(
    salvarAnuncioComEstado,
    inicial,
  );
  const p = perfil.prestador;

  return (
    <form action={acao}>
      <Secao
        titulo="Seu anúncio"
        descricao="É como você aparece para quem procura profissional em Sinop."
        estado={estado}
        pendente={pendente}
      >
        <Field label="Categoria" required error={estado.campos?.categoriaId}>
          <Select
            name="categoriaId"
            defaultValue={p?.categoriaId ? String(p.categoriaId) : ""}
            required
          >
            <option value="">Escolha uma categoria</option>
            {SERVICE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Descrição"
          required
          hint="O que você faz, como cobra, o que inclui. Mínimo de 20 caracteres."
          error={estado.campos?.descricao}
        >
          <Textarea
            name="descricao"
            rows={5}
            defaultValue={p?.descricao ?? ""}
            required
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label="Preço inicial (R$)"
            hint="A partir de quanto."
            error={estado.campos?.precoInicial}
          >
            <Input
              name="precoInicial"
              type="number"
              min={0}
              defaultValue={p?.precoInicial ?? ""}
            />
          </Field>

          <Field
            label="Anos de experiência"
            error={estado.campos?.anosExperiencia}
          >
            <Input
              name="anosExperiencia"
              type="number"
              min={0}
              defaultValue={p?.anosExperiencia ?? ""}
            />
          </Field>
        </div>

        <CampoBairrosAtendidos
          cidade={perfil.usuario.cidade}
          selecionados={p?.bairrosAtendidos ?? []}
          error={estado.campos?.bairrosAtendidos}
        />
      </Secao>
    </form>
  );
}

function Empresa({ perfil }: { perfil: PerfilCompleto }) {
  const [estado, acao, pendente] = useActionState(
    salvarEmpresaComEstado,
    inicial,
  );
  const e = perfil.empresa;

  return (
    <form action={acao}>
      <Secao
        titulo="Sua empresa"
        descricao="É o que a candidata lê antes de decidir se confia na vaga."
        estado={estado}
        pendente={pendente}
      >
        <Field label="Razão social" required error={estado.campos?.razaoSocial}>
          <Input
            name="razaoSocial"
            defaultValue={e?.razaoSocial ?? ""}
            required
          />
        </Field>

        {/*
         * O CNPJ aparece, mas não se edita. É a âncora de identidade da
         * empresa e o que separa vaga real de anúncio falso: poder trocar
         * depois permitiria passar pela verificação e virar outra empresa.
         */}
        <Field
          label="CNPJ"
          hint="Não pode ser alterado. Para corrigir, fale com o suporte."
        >
          <Input value={e?.cnpj ?? ""} disabled readOnly />
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Setor" error={estado.campos?.setor}>
            <Input
              name="setor"
              defaultValue={e?.setor ?? ""}
              placeholder="Agronegócio"
            />
          </Field>

          <Field label="Porte" error={estado.campos?.porte}>
            <Select name="porte" defaultValue={e?.porte ?? ""}>
              <option value="">Não informar</option>
              {["MEI", "Micro", "Pequena", "Média", "Grande"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Site" error={estado.campos?.site}>
          <Input
            name="site"
            type="url"
            defaultValue={e?.site ?? ""}
            placeholder="https://"
          />
        </Field>

        <Field label="Descrição" error={estado.campos?.descricao}>
          <Textarea
            name="descricao"
            rows={4}
            defaultValue={e?.descricao ?? ""}
          />
        </Field>
      </Secao>
    </form>
  );
}

/**
 * Só o bloco do papel de quem entrou.
 *
 * Mostrar os três com campos desabilitados ensinaria o vocabulário dos
 * outros papéis a quem não precisa dele, e faria a tela parecer três vezes
 * maior do que o trabalho que ela pede.
 */
export function FormularioDePerfil({
  perfil,
  linkCurriculo,
  temArmazenamento,
}: {
  perfil: PerfilCompleto;
  linkCurriculo: string | null;
  temArmazenamento: boolean;
}) {
  const papel = perfil.usuario.papel;
  const u = perfil.usuario;

  return (
    <>
      {/*
       * A foto vem primeiro: é o que a pessoa reconhece primeiro no
       * próprio perfil, e é o campo que mais muda a impressão de quem
       * está do outro lado decidindo se contrata.
       */}
      <CampoDeArquivo
        titulo="Foto de perfil"
        descricao="Aparece na busca e ao lado do seu nome. Perfil com foto passa mais confiança para quem vai contratar."
        formatos="JPG, PNG ou WEBP, até 2 MB"
        accept="image/jpeg,image/png,image/webp"
        enviar={enviarFotoComEstado}
        remover={() => removerFoto({})}
        disponivel={temArmazenamento}
      >
        <PreviaDeImagem url={u.avatarUrl} nome={u.nomeCompleto} />
      </CampoDeArquivo>

      <Conta perfil={perfil} />

      {papel === "candidato_clt" && (
        <>
          <Curriculo perfil={perfil} />
          <CampoDeArquivo
            titulo="Currículo em PDF"
            descricao="Vai junto com a candidatura. Só a empresa da vaga vê — não aparece em busca pública."
            formatos="PDF, até 5 MB"
            accept="application/pdf"
            enviar={enviarCurriculoComEstado}
            remover={() => removerCurriculo({})}
            disponivel={temArmazenamento}
          >
            <PreviaDeCurriculo link={linkCurriculo} />
          </CampoDeArquivo>
        </>
      )}

      {papel === "prestador_servico" && <Anuncio perfil={perfil} />}

      {papel === "empresa" && (
        <>
          <Empresa perfil={perfil} />
          <CampoDeArquivo
            titulo="Logo da empresa"
            descricao="Aparece em cada vaga que você publica. É o que faz a vaga parecer de empresa de verdade."
            formatos="JPG, PNG ou WEBP, até 2 MB"
            accept="image/jpeg,image/png,image/webp"
            enviar={enviarLogoComEstado}
            remover={() => removerLogo({})}
            disponivel={temArmazenamento}
          >
            <PreviaDeImagem
              url={perfil.empresa?.logoUrl ?? null}
              nome={perfil.empresa?.razaoSocial ?? u.nomeCompleto}
            />
          </CampoDeArquivo>
        </>
      )}
    </>
  );
}
