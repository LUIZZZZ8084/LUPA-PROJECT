#!/usr/bin/env node
/**
 * Confere se o ROADMAP.md ainda diz a verdade.
 *
 *   node scripts/conferir-roadmap.mjs
 *
 * POR QUE ISTO EXISTE
 * ───────────────────
 * O ROADMAP.md é o único lugar do repositório que responde "o que está
 * pronto e o que falta" sem obrigar ninguém a reconstruir a história a
 * partir de PRs mergeados. É o que o Paulinho abre para saber onde
 * estamos.
 *
 * Ele já ficou errado uma vez: listava como pendentes as três ações do
 * painel da empresa depois de as três terem sido entregues. Documento que
 * erra uma vez deixa de ser consultado — e aí a informação volta a viver
 * só na cabeça de quem esteve nas conversas, que é exatamente o que ele
 * existe para evitar.
 *
 * Manter isso na mão depende de alguém lembrar. Lembrar falhou. Então a
 * CI passa a cobrar.
 *
 * O QUE É CONFERIDO
 * ─────────────────
 * 1. Todo item pendente (`- [ ]`) aponta para uma Issue. Item sem Issue é
 *    intenção, não trabalho combinado — e ninguém sabe onde discutir.
 *
 * 2. Nenhuma Issue fechada continua listada como pendente. Esta é a que
 *    pega a mentira de verdade, e pega independente de como ela apareceu:
 *    merge que esqueceu de atualizar, Issue fechada pela interface do
 *    GitHub, tanto faz.
 *
 * 3. Se o PR fecha uma Issue que está no roadmap como pendente, o PR
 *    precisa tocar no ROADMAP.md. Sem isso, a regra 2 só acusaria o erro
 *    no próximo PR de outra pessoa — e cobrar de quem não causou é como
 *    se aprende a ignorar a verificação.
 *
 * COMO RODAR SEM TOKEN
 * ────────────────────
 * A regra 1 é estrutural e roda sempre. As regras 2 e 3 precisam falar com
 * o GitHub; sem `GITHUB_TOKEN` no ambiente, elas são puladas com aviso, em
 * vez de o script falhar. Verificação que não roda na máquina de quem está
 * desenvolvendo é verificação que só reprova no fim.
 */

import { readFileSync } from "node:fs";
import { request } from "node:https";

const REPO = process.env.GITHUB_REPOSITORY ?? "LUIZZZZ8084/LUPA-PROJECT";
const TOKEN = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";

/** Corpo do PR e arquivos alterados, quando a CI os fornece. */
const CORPO_DO_PR = process.env.CORPO_DO_PR ?? "";
const ARQUIVOS_ALTERADOS = process.env.ARQUIVOS_ALTERADOS ?? "";

const problemas = [];
const avisos = [];

const roadmap = readFileSync("ROADMAP.md", "utf8");
const linhas = roadmap.split(/\r?\n/);

/* ============================================================
   Regra 1 — todo pendente aponta para uma Issue
   ============================================================ */

/** Linhas `- [ ] ...`, com o número da Issue quando houver. */
const pendentes = [];

linhas.forEach((linha, i) => {
  if (!/^\s*-\s*\[ \]/.test(linha)) return;

  const numero = acharNumeroDeIssue(linha, linhas[i + 1]);
  pendentes.push({ linha: i + 1, texto: linha.trim(), numero });

  if (numero === null) {
    problemas.push(
      `ROADMAP.md:${i + 1} — item pendente sem Issue: ${resumir(linha)}\n` +
        "  Item sem Issue é intenção, não trabalho combinado. Abra a Issue " +
        "e cite o número.",
    );
  }
});

/*
 * O link da Issue às vezes cai na linha seguinte, porque o arquivo é
 * quebrado em 76 colunas. Procurar só na mesma linha acusaria item que
 * está correto.
 */
function acharNumeroDeIssue(linha, proxima) {
  const em = (t) => /issues\/(\d+)/.exec(t ?? "")?.[1];
  const achado =
    em(linha) ?? (proxima && !/^\s*-/.test(proxima) ? em(proxima) : undefined);
  return achado ? Number(achado) : null;
}

function resumir(linha) {
  const limpo = linha.trim().replace(/\s+/g, " ");
  return limpo.length > 70 ? `${limpo.slice(0, 67)}…` : limpo;
}

/* ============================================================
   Regras 2 e 3 — precisam falar com o GitHub
   ============================================================ */

if (!TOKEN) {
  avisos.push(
    "Sem GITHUB_TOKEN: conferi só a estrutura. O estado das Issues não foi " +
      "verificado — isso a CI faz.",
  );
} else {
  const comNumero = pendentes.filter((p) => p.numero !== null);
  const estados = await Promise.all(
    comNumero.map(async (p) => ({
      ...p,
      estado: await estadoDaIssue(p.numero),
    })),
  );

  for (const p of estados) {
    if (p.estado === "closed") {
      problemas.push(
        `ROADMAP.md:${p.linha} — a Issue #${p.numero} está fechada e o ` +
          `roadmap ainda diz que está pendente.\n` +
          '  Mova o item para "Concluído", com o link do PR que entregou.',
      );
    }
  }

  // Regra 3: o PR que fecha um pendente precisa tocar no roadmap.
  const fechadasPeloPr = numerosFechadosPor(CORPO_DO_PR);
  const tocaRoadmap = ARQUIVOS_ALTERADOS.split(/\s+/).includes("ROADMAP.md");

  if (fechadasPeloPr.length > 0 && !tocaRoadmap) {
    const noRoadmap = fechadasPeloPr.filter((n) =>
      pendentes.some((p) => p.numero === n),
    );
    if (noRoadmap.length > 0) {
      problemas.push(
        `Este PR fecha ${noRoadmap.map((n) => `#${n}`).join(", ")}, que ` +
          "o roadmap lista como pendente, e não altera o ROADMAP.md.\n" +
          '  Mova o item para "Concluído" no mesmo PR: deixar para depois ' +
          "é como o roadmap ficou errado da última vez.",
      );
    }
  }
}

/** `Closes #12`, `Fecha #12`, `resolve #12` — nas formas que o GitHub aceita. */
function numerosFechadosPor(corpo) {
  const padrao =
    /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|fecha(?:m|do)?|corrige|resolvido)\s*:?\s*#(\d+)/gi;
  return [...new Set([...corpo.matchAll(padrao)].map((m) => Number(m[1])))];
}

async function estadoDaIssue(numero) {
  const issue = await pedirJson(`/repos/${REPO}/issues/${numero}`);

  /*
   * Falha de rede ou Issue que não existe não pode reprovar a entrega: a
   * verificação existe para pegar roadmap desatualizado, não para tornar
   * a CI refém da API do GitHub.
   */
  if (!issue) {
    avisos.push(`Não consegui ler a Issue #${numero}. Item não conferido.`);
    return null;
  }

  return issue.state;
}

/**
 * `node:https` sem conexão reaproveitada, em vez de `fetch`.
 *
 * O `fetch` do Node mantém a conexão viva depois da resposta, e no Windows
 * o processo às vezes termina antes de ela fechar: o Node cai com asserção
 * do libuv e o script sai com 127 mesmo tendo passado. Medido aqui — em
 * cinco execuções iguais, três falharam e duas passaram.
 *
 * Verificação que reprova de vez em quando, por motivo nenhum, é pior que
 * verificação nenhuma: ensina o time a ignorar vermelho, e aí o vermelho
 * que importa passa junto. `agent: false` é uma conexão por pedido,
 * encerrada ao fim. São poucos pedidos; o custo é irrelevante e a saída é
 * sempre a mesma.
 */
function pedirJson(caminho) {
  return new Promise((resolve) => {
    const req = request(
      {
        host: "api.github.com",
        path: caminho,
        method: "GET",
        agent: false,
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "lupa-conferir-roadmap",
        },
      },
      (res) => {
        let corpo = "";
        res.setEncoding("utf8");
        res.on("data", (parte) => {
          corpo += parte;
        });
        res.on("end", () => {
          if (res.statusCode !== 200) return resolve(null);
          try {
            resolve(JSON.parse(corpo));
          } catch {
            resolve(null);
          }
        });
      },
    );

    req.setTimeout(10_000, () => {
      req.destroy();
      resolve(null);
    });
    req.on("error", () => resolve(null));
    req.end();
  });
}

/* ============================================================
   Resultado
   ============================================================ */

for (const aviso of avisos) console.log(`aviso: ${aviso}`);

if (problemas.length === 0) {
  console.log(
    `ROADMAP.md em dia — ${pendentes.length} item(ns) pendente(s) conferido(s).`,
  );
} else {
  console.error(`\nO ROADMAP.md está desatualizado (${problemas.length}):\n`);
  for (const p of problemas) console.error(`  • ${p}\n`);
  console.error(
    "O roadmap é o que o time abre para saber onde estamos. Errado uma vez,\n" +
      "ele deixa de ser consultado.\n",
  );
  process.exitCode = 1;
}
