"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import {
  bairrosDe,
  CIDADE_INICIAL,
  CIDADES,
  ESTADO,
  MAX_BAIRROS_ATENDIDOS,
} from "@/lib/constants";

/**
 * Cidade e bairro, juntos porque um decide o outro.
 *
 * Quatro telas pedem esse par — cadastro, edição de perfil, publicar vaga e
 * editar vaga. Antes eram quatro cópias de "Sinop fixo + os 14 bairros de
 * Sinop". Repetir agora a regra "lista onde existe curadoria, texto livre
 * onde não existe" nas quatro daria quatro chances de divergir.
 *
 * O bairro reage à cidade em tempo real, e por isso isto é componente de
 * cliente. Sem JavaScript ainda funciona: o campo de bairro nasce no modo
 * certo para a cidade inicial, e o servidor aceita as duas formas.
 */

export function CampoCidade({
  name = "cidade",
  value,
  onChange,
  error,
  label = "Cidade",
}: {
  name?: string;
  value: string;
  onChange: (cidade: string) => void;
  error?: string;
  label?: string;
}) {
  return (
    <Field label={label} required error={error}>
      <Select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {CIDADES.map((c) => (
          <option key={c} value={c}>
            {c} - {ESTADO}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/**
 * Um bairro só: lista quando a cidade tem curadoria, texto quando não tem.
 *
 * O `datalist` some de propósito quando não há lista: um campo com sugestão
 * vazia parece quebrado. Sem lista, é um campo de texto comum e pronto.
 */
export function CampoBairro({
  cidade,
  defaultValue,
  error,
  name = "bairro",
}: {
  cidade: string;
  defaultValue?: string | null;
  error?: string;
  name?: string;
}) {
  const bairros = bairrosDe(cidade);
  const [valor, setValor] = useState(defaultValue ?? "");

  if (bairros.length === 0) {
    return (
      <Field
        label="Bairro"
        error={error}
        hint={`Ainda não temos a lista de bairros de ${cidade}. Escreva o seu.`}
      >
        <Input
          name={name}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          maxLength={60}
          placeholder="Centro"
        />
      </Field>
    );
  }

  return (
    <Field label="Bairro" error={error}>
      <Select
        name={name}
        value={bairros.includes(valor) ? valor : ""}
        onChange={(e) => setValor(e.target.value)}
      >
        <option value="">Não informar</option>
        {bairros.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/**
 * Vários bairros, para o prestador dizer onde atende.
 *
 * Com lista, caixas de seleção: no celular o `select` múltiplo exige
 * segurar uma tecla que não existe ali. Sem lista, um campo de texto
 * separado por vírgula — e o `name` repetido faz o `FormData` chegar como
 * array nos dois casos, então o servidor não precisa saber qual modo a
 * tela usou.
 */
export function CampoBairrosAtendidos({
  cidade,
  selecionados,
  error,
  name = "bairrosAtendidos",
}: {
  cidade: string;
  selecionados: readonly string[];
  error?: string;
  name?: string;
}) {
  const bairros = bairrosDe(cidade);
  const [texto, setTexto] = useState(selecionados.join(", "));

  if (bairros.length === 0) {
    /*
     * Um `input` por bairro digitado, escondido, para o servidor receber a
     * mesma forma dos dois modos. A alternativa — mandar a string crua e
     * dividir no servidor — colocaria a regra de separação em dois lugares.
     */
    const lista = texto
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean)
      .slice(0, MAX_BAIRROS_ATENDIDOS);

    return (
      <div>
        <Field
          label="Bairros atendidos"
          error={error}
          hint={`Separe por vírgula. Até ${MAX_BAIRROS_ATENDIDOS}.`}
        >
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Centro, Jardim das Américas"
          />
        </Field>
        {lista.map((b) => (
          <input key={b} type="hidden" name={name} value={b} />
        ))}
      </div>
    );
  }

  return (
    <fieldset>
      <legend className="mb-2 font-medium text-sm">Bairros atendidos</legend>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {bairros.map((b) => (
          <label key={b} className="flex items-center gap-2 text-muted text-sm">
            <input
              type="checkbox"
              name={name}
              value={b}
              defaultChecked={selecionados.includes(b)}
              className="h-4 w-4 flex-none rounded border-line bg-panel-2 accent-servicos"
            />
            <span className="truncate">{b}</span>
          </label>
        ))}
      </div>
      {error && <p className="mt-2 text-danger text-xs">{error}</p>}
    </fieldset>
  );
}

/** Estado compartilhado da cidade escolhida, para o bairro reagir. */
export function useCidade(inicial?: string | null) {
  return useState(inicial || CIDADE_INICIAL);
}
