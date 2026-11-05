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
  const candidato = exigirCapacidade(sessao, "candidato:gerar_curriculo");
  return curriculoEmPdf(candidato.usuarioId);
}

/**
 * O PDF de uma conta que já tem o gerador liberado.
 *
 * Separado de `gerarCurriculoDoCandidato` para a área de testes do admin
 * (#516) passar pelo mesmo caminho do candidato — a checagem de que já
 * comprou e a montagem do PDF —, sem a do papel, que o admin não tem. Quem
 * chama já decidiu de quem é o currículo: aqui não há sessão nenhuma.
 */
export async function curriculoEmPdf(usuarioId: string): Promise<Buffer> {
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
    areaDesejada: perfil.areaDesejada,
    resumo: perfil.resumo,
    formacao: perfil.formacao,
    habilidades: perfil.habilidades,
    experiencias: perfil.experiencias,
    disponibilidade: perfil.disponibilidade,
  });
}

/**
 * O que falta no perfil para o currículo não sair magro (#531).
 *
 * O PDF só mostra o que está preenchido — seção vazia não entra —, e quem
 * comprava sem ter preenchido nada recebia o nome e o contato e mais nada.
 * A tela do gerador mostra esta lista antes do download, na ordem em que as
 * seções aparecem no PDF, para a pessoa completar antes de mandar a uma
 * empresa.
 */
export async function oQueFaltaNoCurriculo(
  sessao: Autenticado | null,
): Promise<string[]> {
  if (!sessao) return [];
  const perfil = await repositorioUsuarios().perfilCandidato(sessao.usuarioId);
  if (!perfil) return [];

  const vazio = (s: string | null) => !s?.trim();
  return [
    vazio(perfil.areaDesejada) && "Área desejada",
    vazio(perfil.resumo) && "Resumo profissional",
    perfil.experiencias.length === 0 && "Experiências profissionais",
    vazio(perfil.formacao) && "Formação",
    perfil.habilidades.length === 0 && "Habilidades",
    vazio(perfil.disponibilidade) && "Disponibilidade",
  ].filter((f): f is string => Boolean(f));
}

/** Se a pessoa já comprou o gerador — para a tela decidir o que mostrar. */
export async function geradorCurriculoLiberado(
  sessao: Autenticado | null,
): Promise<boolean> {
  if (!sessao) return false;
  const perfil = await repositorioUsuarios().perfilCandidato(sessao.usuarioId);
  return Boolean(perfil?.geradorCurriculoLiberado);
}
