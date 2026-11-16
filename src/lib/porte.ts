/**
 * O porte da empresa por extenso (#626).
 *
 * O banco guarda o valor curto do formulário ("MEI", "Micro", "Pequena",
 * "Média", "Grande"). A página pública montava `Porte ${porte.toLowerCase()}`
 * e saía "Porte média" e "Porte mei": concordância errada e sigla em
 * minúscula. Aqui cada valor vira o nome que se fala.
 *
 * Valor fora da lista (dado antigo, digitado à mão) aparece como veio: é
 * melhor mostrar o que a empresa escreveu do que esconder.
 */
const POR_EXTENSO: Record<string, string> = {
  MEI: "MEI",
  Micro: "Microempresa",
  Pequena: "Pequena empresa",
  Média: "Média empresa",
  Grande: "Grande empresa",
};

export function porteDaEmpresa(porte: string): string {
  return POR_EXTENSO[porte] ?? porte;
}
