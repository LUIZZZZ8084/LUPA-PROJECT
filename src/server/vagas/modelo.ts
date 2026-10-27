import "server-only";

import { empresaDoPainel, getJobById } from "@/lib/data";

/**
 * Os campos de um formulário de vaga, como texto: é o que o formulário
 * recebe para abrir preenchido. Mesma forma de `DadosDaVaga`, a que a revisão
 * mostra — os dois são "o que a pessoa digitaria".
 */
export interface ModeloDeVaga {
  titulo: string;
  categoria: string;
  tipoContrato: string;
  modalidade: string;
  /** "sim" ou "nao", como o rádio do formulário. */
  paraPcd: string;
  cidade: string;
  bairro: string;
  endereco: string;
  habilidades: string;
  salarioMin: string;
  salarioMax: string;
  descricao: string;
}

/**
 * O texto de uma vaga antiga, para publicar outra parecida (#492).
 *
 * Vaga encerrada ou vencida mostra "Publicar outra parecida", e o caminho
 * leva o id dela em `?modelo=`. Só é lido **se a vaga é da própria empresa**:
 * o id vem da URL, e copiar o texto de uma vaga alheia seria ler o que a
 * outra empresa escreveu pela porta do formulário. Vaga que não existe ou não
 * é sua não preenche nada — o formulário abre vazio, como sempre, sem dizer
 * qual dos dois foi.
 */
export async function modeloDeVaga(
  usuarioId: string,
  id: string | undefined,
): Promise<ModeloDeVaga | null> {
  if (!id) return null;
  const vaga = await getJobById(id);
  if (!vaga || vaga.company_id !== empresaDoPainel(usuarioId)) return null;

  return {
    titulo: vaga.title,
    categoria: vaga.category ?? "",
    tipoContrato: vaga.contract_type ?? "",
    modalidade: vaga.work_mode ?? "",
    paraPcd: vaga.for_pcd ? "sim" : "nao",
    cidade: vaga.city,
    bairro: vaga.neighborhood ?? "",
    endereco: vaga.address ?? "",
    habilidades: vaga.skills.join(", "),
    salarioMin: vaga.salary_min ? String(vaga.salary_min) : "",
    salarioMax: vaga.salary_max ? String(vaga.salary_max) : "",
    descricao: vaga.description,
  };
}
