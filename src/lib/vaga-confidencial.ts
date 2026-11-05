import type { JobListing } from "./types";

/**
 * Como a vaga diz quem contrata (#538).
 *
 * A vaga comum mostra a empresa. A vaga de agência mostra a descrição do
 * cliente, que não tem nome, e a conta que publicou, que é quem recebe as
 * candidaturas — o candidato precisa saber com quem vai falar.
 *
 * Um lugar só porque o nome aparece no card, no detalhe, na prévia do link e
 * na arte do story: cada um escrito à mão seria o próximo lugar onde a vaga
 * confidencial mostra só o nome da agência como se ela fosse a contratante.
 */
export function quemContrata(
  job: Pick<JobListing, "hiring_for"> & {
    company: Pick<JobListing["company"], "company_name">;
  },
): string {
  return job.hiring_for
    ? `${job.hiring_for}, via ${job.company.company_name}`
    : job.company.company_name;
}
