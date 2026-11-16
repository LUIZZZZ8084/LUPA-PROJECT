/**
 * Talentos salvos (#618): as pessoas que a empresa guardou para uma próxima
 * vaga. Uma linha por empresa e por pessoa.
 *
 * Só quem se candidatou a uma vaga da empresa pode ser salvo — é a relação
 * que a pessoa iniciou, e a base para a empresa guardar o contato dela.
 * Salvar não avisa a pessoa e não muda a candidatura.
 */
export interface RepositorioTalentos {
  salvar(empresaId: string, candidatoId: string): Promise<void>;
  remover(empresaId: string, candidatoId: string): Promise<void>;
  /** Os ids das pessoas salvas pela empresa. */
  salvosDa(empresaId: string): Promise<Set<string>>;
}
