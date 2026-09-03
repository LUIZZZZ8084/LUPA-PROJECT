import type { Papel } from "../auth/rbac";
import { erros } from "../errors";
import { repositorioUsuarios } from "../repositories";
import type { Especie } from "./regras";
import { enviarArquivo, removerArquivo, urlAssinada } from "./servico";

/**
 * Liga o envio de arquivo ao perfil de quem enviou.
 *
 * Duas escritas em sistemas diferentes: o objeto no Storage e a referência
 * no banco. Elas não são atômicas, e a ordem escolhida decide qual falha é
 * pior. Grava-se o arquivo primeiro: se o banco falhar depois, sobra um
 * objeto órfão no bucket — invisível, barato, e substituído no próximo
 * envio, porque o caminho é fixo por pessoa. Na ordem inversa, o banco
 * apontaria para um arquivo que não existe, e a tela mostraria imagem
 * quebrada para todo mundo que abrisse o perfil.
 */

/** Quem pode ter cada tipo de arquivo. */
const PAPEL_POR_ESPECIE: Record<Especie, Papel[]> = {
  avatar: ["candidato_clt", "prestador_servico", "empresa", "admin"],
  /*
   * Currículo é do candidato. Um prestador que subisse currículo estaria
   * guardando dado pessoal num lugar que a tela dele nunca mostra — e que
   * ninguém lembraria de apagar.
   */
  curriculo: ["candidato_clt"],
  logo: ["empresa"],
  /*
   * As fotos do feed são do prestador, e só dele: é o portfólio que faz
   * alguém decidir contratar.
   */
  publicacao: ["prestador_servico"],
};

function exigirPapel(papel: Papel, especie: Especie): void {
  if (!PAPEL_POR_ESPECIE[especie].includes(papel)) {
    throw erros.semPermissao(`${papel} não envia ${especie}`);
  }
}

export async function trocarArquivoDoPerfil(
  usuarioId: string,
  papel: Papel,
  especie: Especie,
  arquivo: File,
): Promise<void> {
  exigirPapel(papel, especie);

  /*
   * Foto do feed não passa por aqui.
   *
   * Este módulo guarda a referência no registro da *pessoa* — avatar,
   * logo, currículo, um de cada. A foto de uma publicação pertence àquela
   * publicação, e são até dez. Sem esta recusa, chamar com `publicacao`
   * enviaria o arquivo e não guardaria a referência em lugar nenhum: o
   * envio pareceria dar certo e a foto sumiria.
   */
  if (especie === "publicacao") {
    throw erros.interno("foto de publicação não é arquivo de perfil");
  }

  const { referencia } = await enviarArquivo(usuarioId, especie, arquivo);
  const repo = repositorioUsuarios();

  if (especie === "avatar") await repo.definirAvatar(usuarioId, referencia);
  if (especie === "logo") await repo.definirLogo(usuarioId, referencia);
  if (especie === "curriculo") {
    await repo.definirCurriculo(usuarioId, referencia);
  }
}

export async function apagarArquivoDoPerfil(
  usuarioId: string,
  papel: Papel,
  especie: Especie,
): Promise<void> {
  exigirPapel(papel, especie);

  /*
   * Aqui a ordem se inverte: primeiro a referência, depois o objeto. Se o
   * segundo passo falhar, sobra lixo no bucket — de novo invisível. Na
   * ordem contrária, um erro entre os dois deixaria o perfil apontando
   * para um arquivo já apagado.
   */
  const repo = repositorioUsuarios();

  if (especie === "avatar") await repo.definirAvatar(usuarioId, null);
  if (especie === "logo") await repo.definirLogo(usuarioId, null);
  if (especie === "curriculo") await repo.definirCurriculo(usuarioId, null);

  await removerArquivo(usuarioId, especie);
}

/**
 * Link temporário para o currículo, quando existe.
 *
 * O currículo mora em bucket privado, então não há URL fixa para guardar
 * no banco: o que se guarda é o caminho, e o link nasce a cada visita e
 * expira em seguida.
 */
export async function linkDoCurriculo(
  caminho: string | null,
): Promise<string | null> {
  return urlAssinada(caminho);
}
