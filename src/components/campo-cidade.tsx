"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Field, Select } from "@/components/ui/field";
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

/**
 * A cidade, em dois passos: estado e depois cidade.
 *
 * Quatro telas pedem a cidade — cadastro, publicar vaga, avisos de vaga e a
 * busca. Repetir o seletor em cada uma daria quatro chances de divergir.
 *
 * **Não há campo de bairro de pessoa** (#321, decisão do Luiz em
 * 01/10/2026). O componente se chamava `cidade-e-bairro` porque o bairro
 * reagia à cidade; o bairro saiu do cadastro, do perfil e da busca, e o que
 * sobrou dele é um texto livre e opcional na vaga, que não depende da
 * cidade — por isso não mora aqui.
 */

/**
 * As cidades de um estado, carregadas sob demanda (#301).
 *
 * `useSyncExternalStore`, e não `useEffect` com `setState`: o cache mora no
 * módulo (`src/lib/cidades/index.ts`), e assinar é o que dispara o pedido.
 * No servidor não há lista — a primeira pintura mostra só a cidade já
 * escolhida, e as outras chegam logo depois, sem a pessoa perceber.
 *
 * Exportado para a busca do hero (#380), que escolhe estado e cidade fora de
 * um formulário de cadastro e precisa da mesma lista, carregada do mesmo jeito.
 */
export function useCidadesDaUf(uf: UF | null): readonly string[] | null {
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

/** Estado da cidade escolhida. Sem cidade inicial: quem não tem uma salva
 * escolhe (#301). */
export function useCidade(inicial?: string | null) {
  return useState(inicial ?? "");
}
