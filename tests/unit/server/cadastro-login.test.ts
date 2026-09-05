/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIG_LIMITE, limparLimites } from "@/server/auth/rate-limit";
import { schemaCadastro, schemaLogin } from "@/server/auth/schemas";
import { cadastrar, entrar, usuarioDaSessao } from "@/server/auth/servico";
import { ehAppError } from "@/server/errors";
import { RepositorioMemoria, usarRepositorio } from "@/server/repositories";
import { validar } from "@/server/validation";

const SENHA = "uma senha bem longa";

/** Válidos pelo dígito verificador — a mesma exigência do schema. */
const CPF_CANDIDATO = "52998224725";
const CPF_PRESTADOR = "11144477735";
/** Empresa também informa CPF: o do responsável pela conta (#150). */
const CPF_EMPRESA = "39053344705";

const candidato = {
  papel: "candidato_clt" as const,
  nomeCompleto: "Everton Rodrigues",
  email: "everton@teste.lupa",
  senha: SENHA,
  telefone: "66999220001",
  cidade: "Sinop" as const,
  cpf: CPF_CANDIDATO,
  areaDesejada: "Agronegócio" as const,
};

const prestador = {
  papel: "prestador_servico" as const,
  nomeCompleto: "João Silva",
  email: "joao@teste.lupa",
  senha: SENHA,
  telefone: "66999110001",
  cidade: "Sinop" as const,
  cpf: CPF_PRESTADOR,
  categoriaId: 1,
  descricao: "Instalações elétricas residenciais e comerciais em Sinop.",
  precoInicial: 150,
  bairrosAtendidos: ["Centro", "Menezes"],
};

const empresa = {
  papel: "empresa" as const,
  nomeCompleto: "Luiz Fernando",
  email: "contato@agronorte.teste",
  senha: SENHA,
  telefone: "66999330001",
  cidade: "Sinop" as const,
  razaoSocial: "Agro Norte Ltda.",
  cnpj: "11222333000181",
  cpf: CPF_EMPRESA,
  porte: "Média" as const,
};

describe("cadastro e login", () => {
  let repo: RepositorioMemoria;
  let restaurar: () => void;

  beforeEach(() => {
    repo = new RepositorioMemoria();
    restaurar = usarRepositorio(repo);
    limparLimites();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    restaurar();
    vi.restoreAllMocks();
  });

  /* ---------- Schemas ---------- */

  describe("validação por papel", () => {
    it("aceita os três papéis com os campos próprios", () => {
      for (const dados of [candidato, prestador, empresa]) {
        const r = validar(schemaCadastro, dados);
        expect(
          r.ok,
          `${dados.papel}: ${JSON.stringify(!r.ok && r.erro.campos)}`,
        ).toBe(true);
      }
    });

    /** O trabalhador comum é o público mais numeroso e o menos paciente. */
    it("candidato precisa de poucos campos", () => {
      const r = validar(schemaCadastro, candidato);
      expect(r.ok).toBe(true);
      // Sem currículo, sem experiência, sem formação no cadastro.
      expect(Object.keys(candidato)).toHaveLength(8);
    });

    it("CPF de dígito errado é recusado, para candidato e prestador", () => {
      for (const dados of [candidato, prestador]) {
        const r = validar(schemaCadastro, { ...dados, cpf: "52998224726" });
        expect(r.ok, dados.papel).toBe(false);
        if (r.ok) continue;
        expect(r.erro.campos?.some((c) => c.campo === "cpf")).toBe(true);
      }
    });

    /**
     * "CNPJ é CNPJ, e CPF é CPF" — decisão do Luiz em 05/09/2026 (#150).
     *
     * Este teste dizia o contrário: que a empresa "não pede nem aceita
     * CPF, porque o CNPJ já identifica a empresa". A frase confundia duas
     * perguntas. O CNPJ identifica *a empresa*; ninguém identificava *a
     * pessoa* por trás da conta — e é com ela que se fala quando uma vaga
     * vira reclamação.
     */
    it("empresa sem CPF é recusada, mesmo informando CNPJ", () => {
      const { cpf: _, ...semCpf } = empresa;
      const r = validar(schemaCadastro, semCpf);

      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.erro.campos?.some((c) => c.campo === "cpf")).toBe(true);
    });

    it("empresa com CPF de dígito errado é recusada", () => {
      const r = validar(schemaCadastro, { ...empresa, cpf: "52998224726" });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.erro.campos?.some((c) => c.campo === "cpf")).toBe(true);
    });

    it("prestador sem descrição é recusado — o perfil é o anúncio", () => {
      const { descricao: _, ...semDescricao } = prestador;
      expect(validar(schemaCadastro, semDescricao).ok).toBe(false);
    });

    it("prestador com categoria inexistente é recusado", () => {
      const r = validar(schemaCadastro, { ...prestador, categoriaId: 999 });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.erro.campos?.[0].campo).toBe("categoriaId");
    });

    it("empresa com CNPJ de dígito errado é recusada", () => {
      const r = validar(schemaCadastro, { ...empresa, cnpj: "11222333000182" });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.erro.campos?.some((c) => c.campo === "cnpj")).toBe(true);
    });

    it("telefone fixo é recusado em qualquer papel", () => {
      for (const dados of [candidato, prestador, empresa]) {
        const r = validar(schemaCadastro, { ...dados, telefone: "6635112200" });
        expect(r.ok, dados.papel).toBe(false);
      }
    });

    it("senha curta é recusada", () => {
      expect(validar(schemaCadastro, { ...candidato, senha: "curta" }).ok).toBe(
        false,
      );
    });

    it("papel desconhecido não passa", () => {
      expect(validar(schemaCadastro, { ...candidato, papel: "root" }).ok).toBe(
        false,
      );
    });
  });

  /* ---------- Cadastro ---------- */

  describe("cadastrar", () => {
    it("cria usuário e perfil do papel, em uma passada", async () => {
      const criado = await cadastrar(validarOk(prestador));

      expect(criado.papel).toBe("prestador_servico");
      expect(await repo.perfilPrestador(criado.id)).toMatchObject({
        categoriaId: 1,
        precoInicial: 150,
      });
    });

    it("cria o perfil certo para cada papel", async () => {
      const c = await cadastrar(validarOk(candidato));
      const e = await cadastrar(validarOk(empresa));

      expect(await repo.perfilCandidato(c.id)).toMatchObject({
        areaDesejada: "Agronegócio",
      });
      expect(await repo.perfilEmpresa(e.id)).toMatchObject({
        cnpj: "11222333000181",
        plano: "trial",
      });
    });

    /** O objeto devolvido circula pela aplicação; o hash não pode ir junto. */
    it("nunca devolve o hash da senha", async () => {
      const criado = await cadastrar(validarOk(candidato));
      expect(criado).not.toHaveProperty("senhaHash");
      expect(JSON.stringify(criado)).not.toContain("argon2");
    });

    it("guarda o hash, nunca a senha em claro", async () => {
      const criado = await cadastrar(validarOk(candidato));
      const noBanco = await repo.porId(criado.id);

      expect(noBanco?.senhaHash).toMatch(/^\$argon2id\$/);
      expect(noBanco?.senhaHash).not.toContain(SENHA);
    });

    it("normaliza o e-mail para minúscula", async () => {
      const criado = await cadastrar(
        validarOk({ ...candidato, email: "EVERTON@Teste.Lupa" }),
      );
      expect(criado.email).toBe("everton@teste.lupa");
    });

    /**
     * No cadastro, avisar é necessário: sem isso a pessoa tenta de novo sem
     * entender. No login o mesmo aviso seria enumeração de contas.
     */
    it("e-mail repetido avisa claramente e manda entrar", async () => {
      await cadastrar(validarOk(candidato));

      await expect(cadastrar(validarOk(candidato))).rejects.toMatchObject({
        codigo: "conflito",
        mensagem: expect.stringContaining("Tente entrar"),
      });
    });

    /**
     * O CPF da segunda também muda, de propósito.
     *
     * Desde a #150 a empresa informa CPF, e ele é único: repetindo os
     * dois documentos, este teste passaria pelo conflito de CPF e diria
     * "CNPJ repetido é recusado" sem nunca ter chegado à checagem de
     * CNPJ — verde pelo motivo errado.
     */
    it("CNPJ repetido é recusado", async () => {
      await cadastrar(validarOk(empresa));

      await expect(
        cadastrar(
          validarOk({
            ...empresa,
            email: "outro@agronorte.teste",
            cpf: "16899535009",
          }),
        ),
      ).rejects.toMatchObject({
        codigo: "conflito",
        mensagem: expect.stringContaining("CNPJ"),
      });
    });

    /** E o inverso: mesmo CPF, CNPJ diferente, continua sendo uma pessoa só. */
    it("CPF repetido é recusado também para empresa", async () => {
      await cadastrar(validarOk(empresa));

      await expect(
        cadastrar(
          validarOk({
            ...empresa,
            email: "outro@agronorte.teste",
            cnpj: "45997418000153",
          }),
        ),
      ).rejects.toMatchObject({
        codigo: "conflito",
        mensagem: expect.stringContaining("CPF"),
      });
    });

    /**
     * A mesma regra do CNPJ, para as duas pessoas físicas — inclusive
     * entre papéis diferentes: um CPF é de uma pessoa só, não de um papel.
     */
    it("CPF repetido é recusado, mesmo trocando de papel", async () => {
      await cadastrar(validarOk(candidato));

      await expect(
        cadastrar(
          validarOk({
            ...prestador,
            email: "outro@teste.lupa",
            cpf: candidato.cpf,
          }),
        ),
      ).rejects.toMatchObject({ codigo: "conflito" });
    });

    it("guarda o CPF no usuário, só em dígitos", async () => {
      const criado = await cadastrar(
        validarOk({ ...candidato, cpf: "529.982.247-25" }),
      );
      expect(criado.cpf).toBe(CPF_CANDIDATO);
    });

    /**
     * O CPF vai para `usuarios`; o CNPJ, para `perfis_empresa`. A divisão
     * não é arrumação: `perfis_empresa` tem `grant select` para `anon`, a
     * chave que roda no navegador. CNPJ pode ser público porque é registro
     * público — CPF não é, e por isso mora na tabela que só a chave de
     * serviço alcança, junto do hash de senha.
     */
    it("empresa guarda o CPF em usuarios, e o CNPJ no perfil", async () => {
      const criado = await cadastrar(validarOk(empresa));

      expect(criado.cpf).toBe(CPF_EMPRESA);
      expect(await repo.perfilEmpresa(criado.id)).toMatchObject({
        cnpj: "11222333000181",
      });
    });

    /**
     * Produtor rural e autônomo contratam sem ter aberto empresa — #129,
     * #138. O rádio "Produtor rural ou autônomo (CPF)" troca qual
     * documento é obrigatório, e o CPF válido e único já é a verificação
     * em si, sem chamada de rede — a mesma regra que já vale para o
     * prestador (#133).
     */
    describe("empresa com CPF em vez de CNPJ", () => {
      const produtorRural = {
        ...empresa,
        email: "produtor@teste.lupa",
        tipoDocumento: "cpf" as const,
        cnpj: undefined,
        cpf: "52998224725",
      };

      it("grava o CPF em usuarios, e nenhum CNPJ no perfil", async () => {
        const criado = await cadastrar(validarOk(produtorRural));

        expect(criado.cpf).toBe("52998224725");
        expect(await repo.perfilEmpresa(criado.id)).toMatchObject({
          cnpj: null,
        });
      });

      /**
       * Sem chamada à Receita envolvida — diferente do caminho do CNPJ,
       * que só verifica quando alguém aperta "Conferir CNPJ agora".
       */
      it("já nasce verificada, sem passar pelo botão de conferir CNPJ", async () => {
        const criado = await cadastrar(validarOk(produtorRural));
        expect(criado.docVerificado).toBe(true);
      });

      it("sem CNPJ, o cadastro por CNPJ é recusado por faltar o número", async () => {
        await expect(
          cadastrar(
            validarOk({
              ...empresa,
              email: "sememdocumento@teste.lupa",
              cnpj: undefined,
            }),
          ),
        ).rejects.toMatchObject({ codigo: "validacao" });
      });

      /**
       * A recusa mudou de camada, não de existência.
       *
       * Antes da #150 o CPF era opcional no schema e `servico.ts` exigia
       * quando `tipoDocumento === "cpf"` — por isso este teste chamava
       * `cadastrar()`. Agora o CPF é obrigatório para empresa nos dois
       * modos, então quem recusa é o Zod, antes de o serviço rodar.
       */
      it("via CPF sem informar o CPF é recusado, já na validação", () => {
        const r = validar(schemaCadastro, {
          ...produtorRural,
          email: "outro@teste.lupa",
          cpf: undefined,
        });

        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.erro.campos?.some((c) => c.campo === "cpf")).toBe(true);
      });

      it("CPF repetido é recusado, mesmo vindo de uma empresa", async () => {
        await cadastrar(validarOk(candidato));

        await expect(
          cadastrar(
            validarOk({
              ...produtorRural,
              email: "outra-empresa@teste.lupa",
              cpf: candidato.cpf,
            }),
          ),
        ).rejects.toMatchObject({ codigo: "conflito" });
      });
    });

    it("começa sem nenhuma verificação concluída", async () => {
      const criado = await cadastrar(validarOk(candidato));
      expect(criado.emailVerificado).toBe(false);
      expect(criado.telefoneVerificado).toBe(false);
      expect(criado.docVerificado).toBe(false);
    });
  });

  /* ---------- Login ---------- */

  describe("entrar", () => {
    beforeEach(async () => {
      await cadastrar(validarOk(candidato));
    });

    it("entra com a senha certa", async () => {
      const usuario = await entrar(
        validarOkLogin({ email: candidato.email, senha: SENHA }),
      );
      expect(usuario.email).toBe(candidato.email);
      expect(usuario).not.toHaveProperty("senhaHash");
    });

    it("registra o acesso", async () => {
      const antes = await repo.porEmail(candidato.email);
      expect(antes?.ultimoAcessoEm).toBeNull();

      await entrar(validarOkLogin({ email: candidato.email, senha: SENHA }));

      const depois = await repo.porEmail(candidato.email);
      expect(depois?.ultimoAcessoEm).toBeTruthy();
    });

    /**
     * Distinguir "e-mail não existe" de "senha errada" entrega a lista de
     * quem tem conta — aqui, de quem está procurando emprego.
     */
    it("mesma mensagem para e-mail inexistente e senha errada", async () => {
      const semConta = await capturarErro(() =>
        entrar(validarOkLogin({ email: "ninguem@teste.lupa", senha: SENHA })),
      );
      const senhaErrada = await capturarErro(() =>
        entrar(
          validarOkLogin({ email: candidato.email, senha: "outra senha aqui" }),
        ),
      );

      expect(semConta.mensagem).toBe("E-mail ou senha incorretos.");
      expect(senhaErrada.mensagem).toBe(semConta.mensagem);
      expect(senhaErrada.codigo).toBe(semConta.codigo);
    });

    it("o detalhe técnico distingue os casos, só no log", async () => {
      const semConta = await capturarErro(() =>
        entrar(validarOkLogin({ email: "ninguem@teste.lupa", senha: SENHA })),
      );
      expect(semConta.message).toContain("não encontrado");
      // Mas não vaza para o cliente.
      expect(JSON.stringify(semConta.paraCliente())).not.toContain(
        "não encontrado",
      );
    });

    it("bloqueia depois do teto de tentativas", async () => {
      for (let i = 0; i < CONFIG_LIMITE.MAX_TENTATIVAS; i++) {
        await capturarErro(() =>
          entrar(
            validarOkLogin({ email: candidato.email, senha: "errada!!!" }),
          ),
        );
      }

      const bloqueado = await capturarErro(() =>
        entrar(validarOkLogin({ email: candidato.email, senha: SENHA })),
      );

      expect(bloqueado.codigo).toBe("muitas_tentativas");
      expect(bloqueado.status).toBe(429);
    });

    it("login bem-sucedido zera o contador", async () => {
      for (let i = 0; i < CONFIG_LIMITE.MAX_TENTATIVAS - 1; i++) {
        await capturarErro(() =>
          entrar(
            validarOkLogin({ email: candidato.email, senha: "errada!!!" }),
          ),
        );
      }

      await entrar(validarOkLogin({ email: candidato.email, senha: SENHA }));

      // Depois do sucesso, ainda há margem para errar de novo.
      const erro = await capturarErro(() =>
        entrar(validarOkLogin({ email: candidato.email, senha: "errada!!!" })),
      );
      expect(erro.codigo).toBe("nao_autenticado");
    });

    it("o bloqueio é por e-mail, não afeta outra conta", async () => {
      await cadastrar(validarOk(prestador));

      for (let i = 0; i < CONFIG_LIMITE.MAX_TENTATIVAS; i++) {
        await capturarErro(() =>
          entrar(
            validarOkLogin({ email: candidato.email, senha: "errada!!!" }),
          ),
        );
      }

      await expect(
        entrar(validarOkLogin({ email: prestador.email, senha: SENHA })),
      ).resolves.toBeTruthy();
    });

    it("senha vazia é barrada na validação, antes do serviço", () => {
      expect(
        validar(schemaLogin, { email: candidato.email, senha: "" }).ok,
      ).toBe(false);
    });
  });

  describe("usuarioDaSessao", () => {
    it("devolve o perfil sem hash", async () => {
      const criado = await cadastrar(validarOk(candidato));
      const daSessao = await usuarioDaSessao(criado.id);

      expect(daSessao?.email).toBe(candidato.email);
      expect(daSessao).not.toHaveProperty("senhaHash");
    });

    it("id inexistente devolve null", async () => {
      expect(await usuarioDaSessao("nao-existe")).toBeNull();
    });
  });
});

/* ---------- Auxiliares ---------- */

/**
 * Um CPF válido por número, para as contas de teste que a suíte cria em
 * lote. Determinístico e não repete `CPF_CANDIDATO`/`CPF_PRESTADOR`
 * porque o cadastro agora recusa CPF repetido, mesmo entre papéis.
 */
function cpfDeTeste(n: number): string {
  const base = String(100_000_001 + n).padStart(9, "0");

  const digito = (numero: string) => {
    const peso = numero.length + 1;
    let soma = 0;
    for (let i = 0; i < numero.length; i++) {
      soma += Number(numero[i]) * (peso - i);
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const d1 = digito(base);
  return `${base}${d1}${digito(base + d1)}`;
}

function validarOk(dados: unknown) {
  const r = validar(schemaCadastro, dados);
  if (!r.ok) throw new Error(JSON.stringify(r.erro.campos));
  return r.valor;
}

function validarOkLogin(dados: unknown) {
  const r = validar(schemaLogin, dados);
  if (!r.ok) throw new Error(JSON.stringify(r.erro.campos));
  return r.valor;
}

async function capturarErro(fn: () => Promise<unknown>) {
  try {
    await fn();
    throw new Error("esperava um erro, mas passou");
  } catch (e) {
    if (!ehAppError(e)) throw e;
    return e;
  }
}

/**
 * O cadastro é onde o abuso dói neste produto: é ele que vira lead, e conta
 * falsa em massa envenena a única métrica que importa.
 *
 * O limite é por origem, e não por e-mail como no login — quem cria conta
 * em massa troca de e-mail a cada tentativa, e limitar por e-mail não
 * conteria nada.
 */
describe("limite de tentativas no cadastro", () => {
  let restaurarCadastro: () => void;

  /*
   * Preparo próprio: o repositório em memória e o contador de tentativas
   * são de módulo, então sem zerar entre um teste e outro o segundo herda
   * as contas e o bloqueio do primeiro.
   */
  beforeEach(() => {
    restaurarCadastro = usarRepositorio(new RepositorioMemoria());
    limparLimites();
  });

  afterEach(() => restaurarCadastro());

  function conta(n: number) {
    return { ...candidato, email: `pessoa${n}@teste.lupa`, cpf: cpfDeTeste(n) };
  }

  it("contas seguidas da mesma origem acabam bloqueadas", async () => {
    for (let i = 0; i < CONFIG_LIMITE.MAX_TENTATIVAS; i++) {
      await cadastrar(conta(i), "203.0.113.7");
    }

    await expect(cadastrar(conta(99), "203.0.113.7")).rejects.toSatisfy(
      (e) => ehAppError(e) && e.codigo === "muitas_tentativas",
    );
  });

  /** Bloquear uma origem não pode derrubar o cadastro de todo mundo. */
  it("outra origem continua livre", async () => {
    for (let i = 0; i < CONFIG_LIMITE.MAX_TENTATIVAS; i++) {
      await cadastrar(conta(i), "203.0.113.7");
    }

    const outro = await cadastrar(conta(50), "198.51.100.4");
    expect(outro.email).toBe("pessoa50@teste.lupa");
  });

  /**
   * Sucesso conta. No login, sucesso zera o contador porque o que se contém
   * é adivinhação de senha; aqui o que se contém é a criação em si.
   */
  it("o sucesso conta para o limite, senão ele não conteria nada", async () => {
    for (let i = 0; i < CONFIG_LIMITE.MAX_TENTATIVAS; i++) {
      await cadastrar(conta(i), "203.0.113.9");
    }

    await expect(cadastrar(conta(98), "203.0.113.9")).rejects.toThrow();
  });

  /** Sem cabeçalho de origem o app não pode parar de aceitar cadastro. */
  it("origem desconhecida ainda cadastra", async () => {
    const u = await cadastrar(conta(1));
    expect(u.email).toBe("pessoa1@teste.lupa");
  });
});
