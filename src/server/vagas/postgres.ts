import "server-only";

import { clienteDeServico } from "@/lib/supabase/service";
import { erros } from "../errors";
import type {
  DadosNovaVaga,
  EdicaoVaga,
  RepositorioVagas,
  StatusVaga,
  Vaga,
} from "./tipos";

function paraVaga(linha: Record<string, unknown>): Vaga {
  return {
    id: String(linha.id),
    empresaId: String(linha.empresa_id),
    titulo: String(linha.titulo),
    descricao: String(linha.descricao),
    categoria: (linha.categoria as string | null) ?? null,
    cidade: String(linha.cidade),
    bairro: (linha.bairro as string | null) ?? null,
    tipoContrato: (linha.tipo_contrato as string | null) ?? null,
    salarioMin: (linha.salario_min as number | null) ?? null,
    salarioMax: (linha.salario_max as number | null) ?? null,
    habilidades: (linha.habilidades as string[] | null) ?? [],
    status: linha.status as StatusVaga,
    criadoEm: String(linha.criado_em),
  };
}

async function cliente() {
  const supabase = clienteDeServico();
  if (!supabase) throw erros.indisponivel("chave de serviço não configurada");
  return supabase;
}

/** Id sem forma de uuid não é erro de servidor — é "não encontrado". */
function ehIdInvalido(erro: { code?: string }): boolean {
  return erro.code === "22P02";
}

export class RepositorioVagasPostgres implements RepositorioVagas {
  async porId(id: string): Promise<Vaga | null> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("vagas")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      if (ehIdInvalido(error)) return null;
      throw erros.indisponivel(error.message);
    }
    return data ? paraVaga(data) : null;
  }

  async porEmpresa(empresaId: string): Promise<Vaga[]> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("vagas")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("criado_em", { ascending: false });

    if (error) {
      if (ehIdInvalido(error)) return [];
      throw erros.indisponivel(error.message);
    }
    return (data ?? []).map(paraVaga);
  }

  async listar(): Promise<Vaga[]> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("vagas")
      .select("*")
      .order("criado_em", { ascending: false });

    if (error) throw erros.indisponivel(error.message);
    return (data ?? []).map(paraVaga);
  }

  async criar(dados: DadosNovaVaga): Promise<Vaga> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("vagas")
      .insert({
        empresa_id: dados.empresaId,
        titulo: dados.titulo,
        descricao: dados.descricao,
        categoria: dados.categoria,
        cidade: dados.cidade,
        bairro: dados.bairro ?? null,
        tipo_contrato: dados.tipoContrato,
        salario_min: dados.salarioMin ?? null,
        salario_max: dados.salarioMax ?? null,
        habilidades: dados.habilidades ?? [],
      })
      .select("*")
      .single();

    if (error) {
      // 23503 = a empresa não tem perfil ainda.
      if (error.code === "23503") {
        throw erros.conflito(
          "Complete o cadastro da empresa antes de publicar uma vaga.",
        );
      }
      throw erros.indisponivel(error.message);
    }
    return paraVaga(data);
  }

  /**
   * O mapa de campos é escrito à mão, e é isso que o torna perigoso.
   *
   * O repositório em memória faz `{ ...atual, ...campos }` e aceita
   * qualquer campo novo sozinho; este aqui só grava o que está listado.
   * Campo novo em `EdicaoVaga` que ninguém acrescente aqui funciona na
   * demonstração e é ignorado em silêncio em produção — foi o que
   * aconteceu com `cidade`, que entrou com a abertura para Mato Grosso e
   * nunca chegou ao banco.
   *
   * Ao acrescentar campo em `EdicaoVaga`, acrescente aqui também. Há teste
   * comparando as duas listas.
   */
  async atualizar(id: string, campos: EdicaoVaga): Promise<Vaga> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("vagas")
      .update({
        ...(campos.titulo !== undefined ? { titulo: campos.titulo } : {}),
        ...(campos.descricao !== undefined
          ? { descricao: campos.descricao }
          : {}),
        ...(campos.categoria !== undefined
          ? { categoria: campos.categoria }
          : {}),
        ...(campos.cidade !== undefined ? { cidade: campos.cidade } : {}),
        ...(campos.bairro !== undefined ? { bairro: campos.bairro } : {}),
        ...(campos.habilidades !== undefined
          ? { habilidades: campos.habilidades }
          : {}),
        ...(campos.tipoContrato !== undefined
          ? { tipo_contrato: campos.tipoContrato }
          : {}),
        ...(campos.salarioMin !== undefined
          ? { salario_min: campos.salarioMin }
          : {}),
        ...(campos.salarioMax !== undefined
          ? { salario_max: campos.salarioMax }
          : {}),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (error.code === "PGRST116" || ehIdInvalido(error)) {
        throw erros.naoEncontrado("Vaga");
      }
      throw erros.indisponivel(error.message);
    }
    return paraVaga(data);
  }

  async encerrar(id: string): Promise<Vaga> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("vagas")
      .update({ status: "fechada" })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (error.code === "PGRST116" || ehIdInvalido(error)) {
        throw erros.naoEncontrado("Vaga");
      }
      throw erros.indisponivel(error.message);
    }
    return paraVaga(data);
  }
}
