import type { NovaMensagemDeSuporte, RepositorioSuporte } from "./tipos";

/**
 * Mensagens em memória, para o modo demonstração e para o teste.
 *
 * Guarda de verdade, e não descarta: o teste precisa conferir o que foi
 * gravado, e a demonstração precisa que enviar o formulário não pareça ter
 * funcionado sem funcionar.
 */
export class RepositorioSuporteMemoria implements RepositorioSuporte {
  private readonly mensagens: NovaMensagemDeSuporte[] = [];

  async registrar(dados: NovaMensagemDeSuporte): Promise<void> {
    this.mensagens.push(dados);
  }

  /** Só para teste. */
  todas(): NovaMensagemDeSuporte[] {
    return [...this.mensagens];
  }
}
