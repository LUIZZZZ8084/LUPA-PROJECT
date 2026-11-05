import { progressoDoCurriculo } from "@/lib/progresso-do-curriculo";
import type { Autenticado, Papel } from "../auth/rbac";
import { erros } from "../errors";
import { repositorioUsuarios } from "../repositories";
import type {
  PerfilCandidato,
  PerfilEmpresa,
  PerfilPrestador,
  UsuarioPublico,
} from "../repositories/tipos";
import { semSenha } from "../repositories/tipos";
import type {
  DadosBasicos,
  DadosCandidato,
  DadosEmpresa,
  DadosPrestador,
} from "./schemas";

/**
 * Edição de perfil.
 *
 * O serviço não conhece requisição nem cookie: recebe o id de quem está
 * editando e trabalha só com ele. Isso é o que impede a classe inteira de
 * bugs em que alguém troca um id na requisição e edita o perfil de outra
 * pessoa — não existe id de alvo para trocar.
 */

export interface PerfilCompleto {
  usuario: UsuarioPublico;
  candidato: PerfilCandidato | null;
  prestador: PerfilPrestador | null;
  empresa: PerfilEmpresa | null;
}

/** Tudo que a tela de edição precisa, numa ida só. */
export async function perfilParaEditar(
  usuarioId: string,
  papel: Papel,
): Promise<PerfilCompleto> {
  const repo = repositorioUsuarios();

  const usuario = await repo.porId(usuarioId);
  if (!usuario) throw erros.naoEncontrado("usuário");

  /*
   * Só o perfil do papel de quem entrou. Buscar os três para mostrar um
   * seria três consultas e, pior, abriria caminho para a tela renderizar
   * campo de um papel que a pessoa não tem.
   */
  const [candidato, prestador, empresa] = await Promise.all([
    papel === "candidato_clt" ? repo.perfilCandidato(usuarioId) : null,
    papel === "prestador_servico" ? repo.perfilPrestador(usuarioId) : null,
    papel === "empresa" ? repo.perfilEmpresa(usuarioId) : null,
  ]);

  return { usuario: semSenha(usuario), candidato, prestador, empresa };
}

export async function salvarBasicos(
  usuarioId: string,
  dados: DadosBasicos,
): Promise<void> {
  await repositorioUsuarios().atualizarBasicos(usuarioId, {
    telefone: dados.telefone,
  });
}

/**
 * Cada papel salva só o que é dele.
 *
 * A checagem de papel acontece aqui, e não só na tela: um formulário é
 * palpite do cliente sobre o que existe, e o servidor não pode confiar
 * nele. Sem isto, um candidato poderia postar campos de prestador e ganhar
 * um anúncio na busca sem passar pelo cadastro de prestador.
 */
export async function salvarPerfilDoPapel(
  usuarioId: string,
  papel: Papel,
  dados: DadosCandidato | DadosPrestador | DadosEmpresa,
): Promise<void> {
  const repo = repositorioUsuarios();

  if (papel === "candidato_clt") {
    await repo.salvarPerfilCandidato(usuarioId, dados as DadosCandidato);
    return;
  }

  if (papel === "prestador_servico") {
    await repo.salvarPerfilPrestador(usuarioId, dados as DadosPrestador);
    return;
  }

  if (papel === "empresa") {
    const empresa = await repo.perfilEmpresa(usuarioId);
    /*
     * Sem linha de empresa não há o que atualizar, e criar aqui exigiria
     * inventar um CNPJ. Empresa sem CNPJ é exatamente o que a plataforma
     * não pode ter: é o que separa vaga real de anúncio falso.
     */
    if (!empresa) throw erros.naoEncontrado("perfil de empresa");

    await repo.salvarPerfilEmpresa(usuarioId, dados as DadosEmpresa);
    return;
  }

  /*
   * Admin administra, não tem perfil profissional. Silenciar seria pior:
   * a tela diria "salvo" sem ter salvo nada.
   */
  throw erros.semPermissao("este papel não tem perfil profissional");
}

/**
 * A barra de progresso do currículo na home (#550), só para candidato.
 *
 * Mora aqui, e não no serviço do currículo, porque aquele carrega o gerador
 * de PDF, e a home não precisa dele. Sem perfil gravado ainda (a conta nunca
 * abriu "Editar perfil"), é 0%: é justamente quem mais precisa do convite.
 * Quem não é candidato recebe `null` e a home não mostra nada.
 */
export async function progressoDoCurriculoDaSessao(
  sessao: Autenticado | null,
): Promise<{ porcento: number; faltas: string[] } | null> {
  if (sessao?.papel !== "candidato_clt") return null;
  const perfil = await repositorioUsuarios().perfilCandidato(sessao.usuarioId);
  return progressoDoCurriculo(perfil);
}
