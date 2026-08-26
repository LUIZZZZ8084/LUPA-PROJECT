# Qualidade, testes e observabilidade

Este documento descreve o que roda, o que cada ferramenta protege e por que
foi escolhida. Se algo aqui atrapalhar mais do que ajudar, tire — ferramenta
que ninguém executa não protege nada.

## Um comando para tudo

```bash
npm run verify
```

Encadeia tipos → lint → código morto → arquitetura → testes com cobertura.
É o mesmo conjunto que roda na integração contínua, então o que passa aqui
passa lá.

O Playwright fica fora do `verify` de propósito: sobe um build de produção e
leva um minuto e meio. Rode separado com `npm run e2e`.

## Testes

| Comando | O que faz |
|---|---|
| `npm test` | Testes unitários (Vitest) |
| `npm run test:watch` | Unitários em modo contínuo |
| `npm run test:cov` | Unitários com relatório de cobertura |
| `npm run e2e` | Playwright: fluxos, responsividade e acessibilidade |
| `npm run e2e:ui` | Playwright em modo interativo, para depurar |
| `npm run test:mutation` | Stryker: qualidade dos próprios testes |

### O que cada camada cobre

**Unitários** (`tests/unit/`) cobrem domínio, dados, formatação e componentes
de apresentação. Os mais importantes:

- `format.test.ts` — salário, telefone, nota e datas. Erro silencioso aqui
  aparece como "R$ 3.200–4.200" errado no card de uma vaga real.
- `observability.test.ts` — a remoção de dados pessoais antes de enviar
  qualquer erro ao Sentry. **É obrigação de LGPD, não preferência.** Se um
  destes testes cair, há vazamento de dado pessoal em produção.
- `demo.test.ts` — a proteção que impede o modo demonstração de abrir
  `wa.me` para o telefone de um terceiro.
- `data.test.ts` e `data-supabase.test.ts` — filtros de busca nos dois
  caminhos: dados de exemplo e Postgres, incluindo o fallback quando a
  consulta falha.
- `cards.test.tsx` — além dos componentes, dois contratos de layout que
  varrem o código-fonte: nenhum elemento pode combinar `flex` com
  `truncate`, e toda grade responsiva precisa declarar a coluna base.
  Os dois nasceram de bugs reais que vazavam a página para fora da tela.

**Playwright** (`tests/e2e/`) roda contra um build de produção, em desktop e
em Pixel 7:

- `responsivo.spec.ts` — 13 rotas × 6 larguras (de 320px a 1280px), afirmando
  que nada rola horizontalmente. Nasceu do bug em que o card de vaga travava
  em 464px dentro de uma coluna de 358px.
- `fluxos.spec.ts` — busca, filtros, candidatura, navegação, e a verificação
  de que nenhum link `wa.me` aponta para telefone de prestador fictício.
- `vaga-de-outra-cidade.spec.ts` — publica uma vaga fora de Sinop com uma
  conta de empresa e confere que ela aparece na busca. Nasceu do bug em que
  a tela de busca chutava "Sinop" quando a URL não trazia cidade: a camada
  de dados estava certa, e só o caminho de ponta a ponta acusava.
- `perto-de-voce.spec.ts` — a ordem por proximidade e o título por cidade.
  A escada tem teste unitário sobre a função pura; o que só o navegador
  responde é se ela chega à tela, porque a ordem depende da sessão.
- `acessibilidade.spec.ts` — axe-core em todas as rotas, WCAG 2.1 AA.

Duas contas para a suíte inteira, criadas uma vez cada em `auth.setup.ts`:
candidato e empresa. Não é só economia de Argon2id — o cadastro tem limite
de 5 por origem em 15 minutos, e uma conta por teste estourava esse limite
no meio da execução, fazendo falhar o cadastro do teste seguinte em vez do
que ele mede. O limite protege contra criação de conta em massa e não se
afrouxa para o teste correr; quem se ajusta é a suíte.

### Cobertura

O escopo medido é `src/lib/**` e `src/components/**`. Rotas, formulários e
server actions ficam de fora **de propósito**: quem os exercita é o
Playwright, num navegador de verdade. Incluí-los produziria um número baixo
que não diz nada sobre risco e empurraria para escrever teste de fachada só
para subir a barra.

Patamar atual: ~92% statements, ~93% linhas. Os pisos em
`vitest.config.mts` ficam logo abaixo disso, para travar o nível sem quebrar
o build por variação de uma linha.

### Teste de mutação

O Stryker altera o código de propósito — troca `>` por `>=`, inverte um `if`
— e verifica se algum teste quebra. Mutante que sobrevive é linha coberta
por um teste que não afirma nada de útil.

Escopo: só a lógica pura de `src/lib`. Score atual **62%**, acima do mínimo
de 60. A distribuição é honesta: `demo.ts` 100%, `format.ts` 89%,
`observability.ts` 67%, `data.ts` 49%. A lacuna real é `data.ts` — os ramos
de construção de consulta têm asserções menos precisas do que poderiam.
Roda só na `main`, porque leva alguns minutos.

## Lint e qualidade de código

| Ferramenta | Papel |
|---|---|
| **Biome** | Formatação e lint geral. Rápido, substitui ESLint + Prettier na maior parte. |
| **ESLint** | Só as regras do Next: hooks, server components, imagens. Já pegou bugs reais que o Biome não cobre. |
| **Knip** | Arquivo, export e dependência sem uso. |
| **dependency-cruiser** | Contratos de arquitetura. |
| **commitlint + husky** | Convenção de mensagem de commit, verificada no `commit-msg`. |

Rodar dois linters é intencional: o Biome é muito mais rápido e cuida do
grosso, mas não conhece as regras específicas do Next. As exceções em
`biome.json` são poucas e cada uma tem justificativa no próprio arquivo.

### Contratos de arquitetura

As camadas são três e a dependência só desce:

```
src/app          rotas e telas
   ↓
src/components   interface reutilizável
   ↓
src/lib          domínio, dados e formatação
```

Regras que falham o build, em `.dependency-cruiser.cjs`:

- `src/lib` não pode importar de `src/components` nem de `src/app`.
- `src/components` não pode importar de `src/app` (exceto server actions).
- `src/lib/mock-data.ts` só pode ser lido por `src/lib/data.ts` — importar
  direto de uma tela faria a tela mostrar dados falsos mesmo com o banco no ar.
- Sem ciclos, sem dependência não declarada, sem devDependency em produção.

## Observabilidade

**Sentry** para erro e desempenho, **OpenTelemetry** (via `@vercel/otel`)
para rastreamento em formato aberto. Datadog e New Relic fazem o mesmo
trabalho e custam caro; com OTel no lugar, trocar de fornecedor depois não
exige reescrever instrumentação.

Tudo é opcional. Sem `NEXT_PUBLIC_SENTRY_DSN` no ambiente, o SDK nem carrega
— o usuário em Sinop, muitas vezes em 3G e aparelho antigo, não paga por um
monitoramento que não está em uso.

### Privacidade, que aqui não é detalhe

`src/lib/observability.ts` limpa todo evento antes do envio:

- Campos com nome sensível (telefone, CPF, CNPJ, documento, selfie, senha,
  token, currículo) têm o valor substituído.
- Telefone, CPF e CNPJ soltos em texto livre são mascarados por padrão.
- A gravação de sessão mascara **todo** texto e **todos** os campos, e só
  grava sessões que deram erro.
- `sendDefaultPii: false`: nem IP, nem cabeçalho de identificação.

### Para ligar

```bash
NEXT_PUBLIC_SENTRY_DSN=...   # Sentry > Settings > Projects > Client Keys
SENTRY_ORG=...               # necessário para subir source maps no build
SENTRY_PROJECT=...
```

Sem `SENTRY_ORG` e `SENTRY_PROJECT`, o wrapper do build não é aplicado —
assim o projeto continua compilando em qualquer máquina, sem configuração.

## Movimento e carregamento

Três regras, em `src/app/globals.css`:

1. **Rápido.** Nada acima de 400ms. A animação existe para explicar a
   mudança, não para ser vista.
2. **A curva conta a física.** Entrada desacelera e assenta; saída acelera e
   some.
3. **O esqueleto tem a forma do conteúdo.** Se o skeleton não imita o layout
   real, a tela pula quando os dados chegam — e num celular lento a pessoa
   já clicou onde o botão estava.

O que existe hoje:

- `loading.tsx` em cada rota, com esqueleto que espelha a tela real.
- Entrada em cascata nas listas (`.stagger`), com teto de atraso.
- Barra de progresso no topo durante a navegação, que só aparece depois de
  120ms — em navegação instantânea, o lampejo incomoda mais do que ajuda.
- `Reveal` para blocos abaixo da dobra. O conteúdo vem visível no HTML do
  servidor: sem JavaScript, nada some.
- Avaliações carregadas sob demanda (`next/dynamic`), com esqueleto próprio.
- Fotos com `loading="lazy"`.
- `prefers-reduced-motion` respeitado — só o shimmer do skeleton continua,
  porque sem ele a tela pareceria travada.

## Integração contínua

`.github/workflows/ci.yml`, em quatro tarefas paralelas: qualidade, testes
unitários com envio ao Codecov, Playwright, e mutação (só na `main`).

Para o Codecov publicar no pull request, adicione `CODECOV_TOKEN` em
Settings → Secrets and variables → Actions. Sem o token, o passo não derruba
o build.
