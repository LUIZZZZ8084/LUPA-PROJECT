# Ligando o Supabase

Passo a passo para sair do modo demonstração e ter dados que sobrevivem ao
deploy. Leva uns 15 minutos.

Enquanto isto não for feito, o app continua funcionando: cadastro e login
rodam em memória e somem no próximo deploy. É de propósito — permite
demonstrar antes de existir infraestrutura.

---

## 1. Criar o projeto

Em [supabase.com](https://supabase.com) → **New project**.

- **Region:** `South America (São Paulo)`. É o mais perto de Sinop; cada
  salto a mais é latência para quem está em 3G.
- **Database password:** gere uma forte e guarde no gerenciador de senhas.
  Ela não é usada pelo app — o app usa as chaves de API — mas é o que dá
  acesso direto ao banco se algo der errado.

O plano gratuito comporta o piloto com folga.

## 2. Rodar o schema

**SQL Editor** → **New query** → cole o conteúdo de
[`supabase/schema.sql`](../supabase/schema.sql) → **Run**.

É um arquivo só, executado de uma vez. Ele cria tipos, tabelas, índices,
triggers, views e as políticas de RLS.

No fim do arquivo há uma seção comentada de **Storage**. Descomente e rode
depois de criar os buckets pelo painel, se for usar upload de arquivo.

> O schema é executado por teste automatizado contra um Postgres real antes
> de cada entrega (`tests/unit/schema.test.ts`). Se ele falhar aqui, é
> porque o banco não estava limpo.

### Se der `already exists`

```
ERROR: 42710: type "papel_usuario" already exists
```

O arquivo já rodou, inteiro ou pela metade. Ele é feito para banco limpo e
para no primeiro objeto que encontra pela frente.

O caminho de volta é [`supabase/reset.sql`](../supabase/reset.sql): cole,
rode, e em seguida rode o `schema.sql` de novo. O reset serve tanto para
execução parcial quanto para execução repetida — nos dois casos o banco
termina limpo.

**O reset apaga todos os dados.** Enquanto o banco é só schema, não há o
que perder. Depois que houver conta de verdade, não rode.

O ciclo schema → reset → schema é exercitado por teste contra um Postgres
real, incluindo o detalhe que engana: funções de trigger e tipos enum
sobrevivem a `drop table cascade` e precisam ser removidos à mão.

### Banco que já tem dado: aplique só a diferença

Depois que existe conta de verdade, o reset está fora de questão e o
`schema.sql` inteiro para no primeiro objeto que já existe. Cada mudança de
schema que precisa alcançar um banco vivo ganha um arquivo próprio, aditivo
e repetível, ao lado do `schema.sql`:

| Arquivo | Quando rodar |
|---|---|
| [`supabase/aplica-visualizacoes.sql`](../supabase/aplica-visualizacoes.sql) | Uma vez, em banco criado antes da Issue #45 |
| [`supabase/aplica-correcao-de-acesso.sql`](../supabase/aplica-correcao-de-acesso.sql) | Uma vez, em banco criado antes da Issue #64 |
| [`supabase/corrige-telefones.sql`](../supabase/corrige-telefones.sql) | Uma vez, em banco que recebeu o seed antes da Issue #24 |

Banco novo não precisa de nenhum deles: o `schema.sql` já traz tudo.

## 3. Criar os buckets de arquivo

**SQL Editor** → cole [`supabase/storage.sql`](../supabase/storage.sql) → **Run**.

Cria os quatro buckets e as políticas de leitura. É um arquivo à parte
porque depende do schema `storage`, que só existe no Supabase — o
`schema.sql` roda em qualquer Postgres, e é o que permite executá-lo por
teste antes de cada entrega.

| Bucket | Público | Para quê |
|---|---|---|
| `avatares` | sim | foto de perfil e logo — aparecem na busca |
| `portfolio` | sim | fotos de trabalho do prestador |
| `curriculos` | **não** | currículo em PDF |
| `verificacao` | **não** | documento e selfie |

Currículo e verificação não recebem policy nenhuma. Com RLS ligada e zero
policies, o Postgres nega tudo — é assim que eles ficam fora do alcance da
chave anônima. O servidor alcança pela chave de serviço e gera URL assinada
de curta duração quando precisa mostrar o arquivo.

Sem esta seção, o app funciona: o envio de arquivos aparece desativado, com
o motivo na tela, e o resto do perfil continua editável.

## 4. Popular com dados de Sinop (opcional)

**SQL Editor** → cole [`supabase/seed.sql`](../supabase/seed.sql) → **Run**.

Cria prestadores, empresas, vagas e avaliações de exemplo, com os mesmos
avatares da demonstração. Útil para a plataforma não abrir vazia enquanto
não houver cadastro de verdade.

**As contas do seed não têm senha.** Elas aparecem na busca e nos perfis,
mas nenhuma senha entra em nenhuma delas — o hash é uma string fixa que não
corresponde a senha alguma.

É de propósito, não uma pendência. Senha compartilhada e versionada em
repositório, valendo para catorze contas, é uma porta aberta para qualquer
um que leia o código. Perfil de exemplo precisa ser visto, não acessado.

Para entrar de verdade, crie a sua conta em `/cadastro`.

**Não rode o seed depois que houver usuário real** — ele assume um banco sem
esses ids.

## 5. Copiar as chaves

**Project Settings** → **API**. Três valores:

| Onde aparece | Variável | Vai para |
|---|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | Navegador |
| `anon` `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Navegador |
| `service_role` `secret` | `SUPABASE_SERVICE_ROLE_KEY` | **Só o servidor** |

**A chave `service_role` ignora todas as regras de segurança do banco.** Ela
nunca leva o prefixo `NEXT_PUBLIC_` — com o prefixo, o Next a embute no
JavaScript que vai para o navegador, e quem abrir o código-fonte da página
tem acesso irrestrito ao banco. Há um teste que trava isso.

## 6. Configurar na Vercel

**Settings** → **Environment Variables** → ambiente **Production**:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SESSION_SECRET
```

O `SESSION_SECRET` assina a sessão. Gere com:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Funciona em qualquer terminal. O `openssl` que a maioria dos tutoriais
sugere não vem instalado no Windows, onde este projeto é desenvolvido.

Sem ele, a aplicação recusa subir em produção — de propósito. Segredo padrão
versionado significa sessão de admin forjável por qualquer um que leia o
repositório.

Depois de salvar, **Deployments** → o último → **Redeploy**. Variável nova só
vale a partir do próximo build.

## 7. Criar sua conta de admin

Crie um `.env.local` na raiz do projeto com pelo menos estas duas linhas —
é o mesmo par da seção anterior, agora do lado de cá:

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=cole-aqui
ADMIN_EMAIL=voce@exemplo.com
ADMIN_TELEFONE=66999110001
ADMIN_NOME=Seu Nome
```

`ADMIN_TELEFONE` é obrigatório: `usuarios.telefone` é `not null` com check
de 10 a 13 dígitos. Com DDD, sem o `+55`. `ADMIN_NOME` é opcional.

A chave tem que ser a **`service_role`**, não a `anon`. No painel do
Supabase a `anon` fica visível e a `service_role` atrás de um botão
*Reveal* — é fácil copiar a errada, e o script avisa se acontecer.

A chave de serviço precisa estar **neste arquivo**, na sua máquina. Tê-la
configurado na Vercel não basta: o script roda aqui, não lá.

O arquivo é ignorado pelo git (`.gitignore`: `.env*`). Então:

```bash
npm run admin:criar
```

O `ADMIN_EMAIL` vai no arquivo de propósito. A forma comum de passá-lo,
`ADMIN_EMAIL=voce@exemplo.com npm run ...`, é sintaxe de bash: no
PowerShell ela falha com *"não é reconhecido como nome de cmdlet"*. Com
tudo no `.env.local`, o comando é o mesmo em qualquer terminal.

O `npm run` carrega o `.env.local` pelo próprio Node. Chamar
`node scripts/criar-admin.mjs` direto **não** carrega — aí as variáveis
precisam estar no ambiente.

Gera uma senha forte e **imprime uma vez só** — guarde antes de fechar o
terminal. Para definir você mesmo, passe `ADMIN_SENHA`.

Rodar de novo com um e-mail que já existe promove a conta a admin e
redefine a senha. É o caminho para recuperar acesso.

Sem isso, `/admin/painel` responde 404 para todo mundo, inclusive para você.

---

## Como o acesso funciona

Duas chaves, com alcances diferentes:

**Chave anônima** — vai para o navegador. Só enxerga o que qualquer
visitante já veria na tela: vagas abertas, perfis de prestador e empresa,
avaliações, publicações ativas.

**Chave de serviço** — só no servidor. Ignora RLS. É o que os repositórios
em `src/server/` usam para ler e escrever em `usuarios`, que guarda hash de
senha e está fechada para a chave anônima.

O que **não** é público, por decisão:

- **Currículo e área desejada.** Nem todo mundo quer que o patrão atual
  descubra que está procurando emprego — e essa informação pode custar o
  emprego que a pessoa ainda tem.
- **Candidaturas.** Só o candidato e a empresa dona da vaga.
- **Documento e selfie.** Bucket privado, apagados na decisão do admin.

## Verificando se funcionou

1. Abra `/cadastro` e crie uma conta de teste
2. **Table Editor** → `usuarios` → a linha deve estar lá, com
   `senha_hash` começando em `$argon2id$`
3. Saia e entre de novo com a mesma senha
4. Faça um deploy — a conta continua lá

Se o passo 2 falhar com erro de permissão, falta a `SUPABASE_SERVICE_ROLE_KEY`.

## Depois: gerar os tipos do banco

Com o projeto no ar, dá para trocar o schema permissivo do cliente pelos
tipos reais:

```bash
npx supabase gen types typescript --project-id SEU_ID > src/lib/supabase/tipos-banco.ts
```

E apontar `SchemaPermissivo` em `src/lib/supabase/service.ts` para eles. Aí
o TypeScript passa a reclamar de coluna inexistente em tempo de compilação,
em vez de em produção.

## O que ainda falta construir

Ao trocar o Supabase Auth por autenticação própria, duas coisas que vinham
prontas passaram a ser nossas:

- **Verificação de e-mail**
- **Recuperação de senha**

As duas precisam existir antes de abrir o cadastro ao público. Hoje, quem
esquece a senha não tem como recuperar sozinho.
