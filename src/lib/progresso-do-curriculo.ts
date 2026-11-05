/**
 * Quanto do currículo do candidato está preenchido, e o que falta (#550).
 *
 * As seis partes são as que o PDF do gerador mostra (#531) e as que fazem a
 * empresa ler a candidatura até o fim. Uma lista só, usada pelo aviso do
 * gerador, pelo perfil e pela home: se cada tela contasse do seu jeito, o
 * perfil diria 100% e o gerador avisaria que o currículo sai incompleto.
 */
export interface CamposDoCurriculo {
  areaDesejada?: string | null;
  resumo?: string | null;
  formacao?: string | null;
  disponibilidade?: string | null;
  habilidades: readonly string[];
  experiencias: readonly unknown[];
}

const cheio = (s: string | null | undefined) => Boolean(s?.trim());

const PARTES: readonly {
  rotulo: string;
  preenchida: (c: CamposDoCurriculo) => boolean;
}[] = [
  { rotulo: "Área desejada", preenchida: (c) => cheio(c.areaDesejada) },
  { rotulo: "Resumo profissional", preenchida: (c) => cheio(c.resumo) },
  {
    rotulo: "Experiências profissionais",
    preenchida: (c) => c.experiencias.length > 0,
  },
  { rotulo: "Formação", preenchida: (c) => cheio(c.formacao) },
  { rotulo: "Habilidades", preenchida: (c) => c.habilidades.length > 0 },
  { rotulo: "Disponibilidade", preenchida: (c) => cheio(c.disponibilidade) },
];

/** As partes ainda vazias, na ordem em que aparecem no formulário. */
export function oQueFaltaNoCurriculoDe(
  campos: CamposDoCurriculo | null,
): string[] {
  return PARTES.filter((p) => !campos || !p.preenchida(campos)).map(
    (p) => p.rotulo,
  );
}

/**
 * Porcentagem inteira, arredondada para baixo: "100%" só aparece com tudo
 * preenchido, e não com cinco de seis arredondado para cima.
 */
export function progressoDoCurriculo(campos: CamposDoCurriculo | null): {
  porcento: number;
  faltas: string[];
} {
  const faltas = oQueFaltaNoCurriculoDe(campos);
  const feitas = PARTES.length - faltas.length;
  return { porcento: Math.floor((feitas / PARTES.length) * 100), faltas };
}
