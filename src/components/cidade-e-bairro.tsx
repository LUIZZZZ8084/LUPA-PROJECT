"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import {
  cidadeComUf,
  cidadesJaCarregadas,
  nomeDaCidade,
  ouvirCidades,
  pedirCidades,
  type UF,
  UFS,
  ufDaCidade,
} from "@/lib/cidades";
import { bairrosDe, MAX_BAIRROS_ATENDIDOS } from "@/lib/constants";

/**
 * Cidade e bairro, juntos porque um decide o outro.
 *
 * Quatro telas pedem esse par — cadastro, edição de perfil, publicar vaga e
 * avisos de vaga. Repetir em cada uma a regra "lista onde existe curadoria,
 * texto livre onde não existe" daria quatro chances de divergir.
 *
 * O bairro reage à cidade em tempo real, e por isso isto é componente de
 * cliente.
 */

/**
 * As cidades de um estado, carregadas sob demanda (#301).
 *
 * `useSyncExternalStore`, e não `useEffect` com `setState`: o cache mora no
 * módulo (`src/lib/cidades/index.ts`), e assinar é o que dispara o pedido.
 * No servidor não há lista — a primeira pintura mostra só a cidade já
 * escolhida, e as outras chegam logo depois, sem a pessoa perceber.
 */
function useCidadesDaUf(uf: UF | null): readonly string[] | null {
  const assinar = useCallback(
    (avisar: () => void) => {
      const parar = ouvirCidades(avisar);
      if (uf) pedirCidades(uf);
      return parar;
    },
    [uf],
  );
  return useSyncExternalStore(
    assinar,
    () => (uf ? (cidadesJaCarregadas(uf) ?? null) : null),
    () => null,
  );
}

/**
 * Estado e cidade, em dois passos (#301).
 *
 * São 5.571 municípios: numa lista só, ninguém acha o seu, e o celular
 * baixaria todos para mostrar um. Escolhido o estado, chegam só as cidades
 * dele. Nenhum estado vem marcado — o app não tem mais "cidade inicial", e
 * um palpite pré-selecionado é o que a pessoa de outro lugar não percebe e
 * grava errado.
 *
 * O que vai para o servidor é só `cidade`, já com o estado ("Sinop - MT").
 * O seletor de estado não tem `name`: ele só decide qual lista mostrar.
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
  // Vale antes de haver cidade: é o que diz qual lista carregar.
  const [ufEscolhida, setUfEscolhida] = useState<UF | null>(ufDaCidade(value));
  const uf = ufDaCidade(value) ?? ufEscolhida;
  const nomes = useCidadesDaUf(uf);

  const opcoes =
    uf && nomes
      ? nomes.map((nome) => cidadeComUf(nome, uf))
      : value
        ? [value]
        : [];

  const instrucao = !uf
    ? "Escolha o estado"
    : nomes
      ? "Escolha a cidade"
      : "Carregando cidades…";

  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
      <Field label="Estado" required>
        <Select
          value={uf ?? ""}
          onChange={(e) => {
            setUfEscolhida((e.target.value || null) as UF | null);
            onChange("");
          }}
        >
          <option value="" disabled>
            UF
          </option>
          {UFS.map((u) => (
            <option key={u.sigla} value={u.sigla} title={u.nome}>
              {u.sigla}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={label} required error={error}>
        <Select
          name={name}
          value={value}
          required
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            {instrucao}
          </option>
          {opcoes.map((c) => (
            <option key={c} value={c}>
              {nomeDaCidade(c)}
            </option>
          ))}
        </Select>
      </Field>
    </div>
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
        hint={
          cidade
            ? `Ainda não temos a lista de bairros de ${nomeDaCidade(cidade)}. Escreva o seu.`
            : "Escreva o seu bairro."
        }
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

/** Estado compartilhado da cidade escolhida, para o bairro reagir. Sem
 * cidade inicial: quem não tem uma salva escolhe (#301). */
export function useCidade(inicial?: string | null) {
  return useState(inicial ?? "");
}
