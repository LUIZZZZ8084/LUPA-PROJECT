import "server-only";

import { type Autenticado, exigirCapacidade } from "../auth/rbac";
import { erros } from "../errors";
import { repositorioUsuarios } from "../repositories";
import { gerarCurriculoPdf } from "./gerar";

/**
 * Gera o PDF de quem já pagou pelo gerador (#47).
 *
 * A capacidade (`candidato:gerar_curriculo`) só diz quem pode chegar até
 * aqui — candidato, sempre. Se a pessoa já comprou é outra pergunta,
 * respondida por `perfilCandidato(...).geradorCurriculoLiberado`, e as
 * duas precisam ser verdadeiras: sem a primeira, um prestador com o id
 * certo geraria currículo de graça; sem a segunda, todo candidato geraria
 * sem nunca ter pago.
 */
export async function gerarCurriculoDoCandidato(
  sessao: Autenticado | null,
): Promise<Buffer> {
  exigirCapacidade(sessao, "candidato:gerar_curriculo");
  // `exigirCapacidade` já lançou se `sessao` fosse nulo.
  const usuarioId = (sessao as Autenticado).usuarioId;

  const repo = repositorioUsuarios();
  const [usuario, perfil] = await Promise.all([
    repo.porId(usuarioId),
    repo.perfilCandidato(usuarioId),
  ]);

  if (!usuario) throw erros.naoEncontrado("Usuário");

  if (!perfil?.geradorCurriculoLiberado) {
    throw erros.semPermissao("gerador de currículo não comprado");
  }

  return gerarCurriculoPdf({
    nomeCompleto: usuario.nomeCompleto,
    email: usuario.email,
    telefone: usuario.telefone,
    cidade: usuario.cidade,
    bairro: usuario.bairro,
    areaDesejada: perfil.areaDesejada,
    resumo: perfil.resumo,
    formacao: perfil.formacao,
    habilidades: perfil.habilidades,
    disponibilidade: perfil.disponibilidade,
  });
}

/** Se a pessoa já comprou o gerador — para a tela decidir o que mostrar. */
export async function geradorCurriculoLiberado(
  sessao: Autenticado | null,
): Promise<boolean> {
  if (!sessao) return false;
  const perfil = await repositorioUsuarios().perfilCandidato(sessao.usuarioId);
  return Boolean(perfil?.geradorCurriculoLiberado);
}
