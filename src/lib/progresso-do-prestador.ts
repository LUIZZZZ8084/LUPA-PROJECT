/**
 * Quanto do anúncio do prestador está preenchido, e o que falta (#602).
 *
 * A mesma ideia da barra do currículo (#550), com as partes que pesam para
 * quem procura serviço: rosto, o que faz, quanto cobra, há quanto tempo
 * faz, e um trabalho para mostrar. Instagram, Facebook e CNPJ ficam de
 * fora de propósito: são opcionais de verdade, e cobrar o que muita gente
 * não tem deixaria a barra presa abaixo de 100% para sempre.
 */
export interface CamposDoAnuncio {
  avatarUrl: string | null;
  descricao: string | null;
  precoInicial: number | null;
  anosExperiencia: number | null;
  /** Trabalhos no feed, em exibição. */
  trabalhosAtivos: number;
}

export interface ParteDoAnuncio {
  rotulo: string;
  /** Onde se preenche: o formulário, ou "Meus trabalhos". */
  onde: "editar" | "trabalhos";
}

const cheio = (s: string | null | undefined) => Boolean(s?.trim());

const PARTES: readonly (ParteDoAnuncio & {
  preenchida: (c: CamposDoAnuncio) => boolean;
})[] = [
  {
    rotulo: "Foto de perfil",
    onde: "editar",
    preenchida: (c) => cheio(c.avatarUrl),
  },
  {
    rotulo: "Descrição do serviço",
    onde: "editar",
    preenchida: (c) => cheio(c.descricao),
  },
  {
    rotulo: "Preço inicial",
    onde: "editar",
    preenchida: (c) => c.precoInicial !== null && c.precoInicial > 0,
  },
  {
    rotulo: "Anos de experiência",
    onde: "editar",
    preenchida: (c) => c.anosExperiencia !== null,
  },
  {
    rotulo: "Foto de um trabalho",
    onde: "trabalhos",
    preenchida: (c) => c.trabalhosAtivos > 0,
  },
];

/** As partes vazias, na ordem em que aparecem para quem procura. */
export function oQueFaltaNoAnuncio(campos: CamposDoAnuncio): ParteDoAnuncio[] {
  return PARTES.filter((p) => !p.preenchida(campos)).map(
    ({ rotulo, onde }) => ({
      rotulo,
      onde,
    }),
  );
}

/** Arredondada para baixo, como a do currículo: 100% só com tudo. */
export function progressoDoAnuncio(campos: CamposDoAnuncio): {
  porcento: number;
  faltas: ParteDoAnuncio[];
} {
  const faltas = oQueFaltaNoAnuncio(campos);
  const feitas = PARTES.length - faltas.length;
  return { porcento: Math.floor((feitas / PARTES.length) * 100), faltas };
}
