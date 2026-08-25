# Arquitetura

O que roda onde, por onde passa dado sensível, e o que acontece quando cada
peça cai.

Este documento existe para alguém novo entender o sistema sem ler o código
inteiro. O *porquê* de cada decisão está no [AGENTS.md](../AGENTS.md); aqui
está o *desenho*.

Os diagramas são Mermaid, que o GitHub renderiza sozinho — sem dependência
nova e sem passo de build.

---

## 1. O que roda onde

```mermaid
graph TB
    subgraph navegador["Navegador — aparelho da pessoa"]
        UI["React Server Components<br/>+ ilhas de cliente"]
        SW["PWA<br/>manifest e ícones"]
    end

    subgraph vercel["Vercel — borda e funções"]
        CDN["CDN<br/>estático em cache global"]
        PROXY["proxy.ts<br/>muro de login"]
        RSC["Render + Server Actions<br/>função serverless"]
    end

    subgraph supabase["Supabase — us-east"]
        PG[("Postgres<br/>RLS ligada")]
        ST["Storage<br/>4 buckets"]
    end

    SENTRY["Sentry<br/>erro e desempenho"]

    UI -->|"HTTPS"| CDN
    CDN --> PROXY
    PROXY -->|"sem sessão: 307 /entrar"| UI
    PROXY -->|"com sessão"| RSC
    RSC -->|"chave anônima<br/>só o catálogo"| PG
    RSC -->|"chave de serviço<br/>ignora RLS"| PG
    RSC -->|"chave de serviço"| ST
    RSC -.->|"erro, já embaralhado"| SENTRY

    classDef fora fill:#2a1f3d,stroke:#8a5be0,color:#e8e6f0
    classDef nosso fill:#12261d,stroke:#2aa871,color:#dff5e9
    class navegador fora
    class vercel,supabase nosso
```

**O navegador nunca fala com o Supabase.** Nem com o Postgres, nem com o
Storage. Tudo passa pela função serverless. É o que permite decidir no
servidor quem pode ler o quê, em vez de deixar a decisão numa policy que
ninguém revisa — e é o que mantém a chave de serviço fora do aparelho.

**A Vercel já é a CDN.** Não há um "adicionar CDN" pendente: o estático sai
da borda com cache global desde o primeiro deploy, e o HTML dinâmico roda na
região mais próxima de quem pediu.

---

## 2. Os limites de confiança

Onde o dado troca de mãos é onde a segurança acontece.

```mermaid
flowchart LR
    subgraph zona1["Não confiável — o aparelho"]
        FORM["Formulário<br/>qualquer campo pode ter sido mexido"]
        COOKIE["Cookie de sessão<br/>assinado, legível"]
    end

    subgraph zona2["Confiável — a função serverless"]
        VALID["Zod<br/>valida toda entrada"]
        SESSAO["Sessão<br/>id + papel, do JWT"]
        RBAC["RBAC<br/>pode? é seu?"]
        SERVICO["Serviço<br/>regra de negócio"]
    end

    subgraph zona3["Fechado — o banco"]
        RLS["RLS + grants"]
        DADOS[("Dados")]
    end

    FORM --> VALID
    COOKIE --> SESSAO
    VALID --> RBAC
    SESSAO --> RBAC
    RBAC --> SERVICO
    SERVICO --> RLS --> DADOS

    classDef perigo fill:#3d1f1f,stroke:#d9534f,color:#f5dede
    classDef seguro fill:#12261d,stroke:#2aa871,color:#dff5e9
    classDef banco fill:#1f2a3d,stroke:#4a90d9,color:#dde8f5
    class zona1 perigo
    class zona2 seguro
    class zona3 banco
```

Três regras que caem deste desenho:

**O papel vem da sessão, nunca do formulário.** Um formulário é palpite do
cliente sobre o que existe. Aceitar o papel dali deixaria um candidato
postar campos de prestador e ganhar um anúncio na busca sem nunca ter
passado pelo cadastro de prestador.

**Duas perguntas em cada operação.** `exigirCapacidade` responde "este papel
pode fazer isto?"; `exigirDono` responde "este registro é desta pessoa?". Só
a primeira deixaria qualquer empresa autenticada alcançar a vaga de outra
trocando o id na URL.

**O banco é a última linha, não a primeira.** RLS e `revoke` valem mesmo
com a aplicação correta — porque a aplicação erra.

---

## 3. As camadas do servidor

```mermaid
flowchart TD
    A["src/app/**/actions.ts<br/><i>server action</i>"]
    B["criarAcao()<br/><i>envelope</i>"]
    C["src/server/*/servico.ts<br/><i>regra de negócio</i>"]
    D{"isSupabaseConfigured?"}
    E["repositório Postgres"]
    F["repositório em memória"]
    G[("Supabase")]
    H["dados de Sinop<br/><i>modo demonstração</i>"]

    A --> B
    B -->|"valida com Zod<br/>captura exceção<br/>registra a chamada"| C
    C --> D
    D -->|sim| E --> G
    D -->|não| F --> H
```

**A action é fina.** Envelopada por `criarAcao()`, que valida a entrada,
captura qualquer exceção e registra a chamada. Exceção nunca chega à
interface como tela de erro do Next.

**O serviço não conhece requisição.** Nem cookie, nem `next/headers`. É o
que permite testar cadastro, login e limites inteiros sem subir servidor.

**O repositório tem duas implementações e um contrato.** O que os testes
exercitam é o mesmo caminho que roda em produção — e é o que mantém o modo
demonstração vivo sem `if` espalhado pelas telas.

---

## 4. Por onde passa dado sensível

```mermaid
flowchart LR
    subgraph publico["Público — catálogo"]
        V1["job_listings"]
        V2["provider_listings"]
        V3["vagas, avaliacoes,<br/>publicacoes, perfis_*"]
    end

    subgraph fechado["Fechado — só chave de serviço"]
        T1["usuarios<br/><i>hash de senha</i>"]
        T2["perfis_candidato<br/><i>currículo</i>"]
        T3["candidaturas"]
        T4["pedidos_verificacao<br/><i>documento e selfie</i>"]
        T5["visualizacoes_vaga<br/><i>métrica da empresa</i>"]
    end

    ANON(["chave anônima"]) --> publico
    ANON -.->|"42501<br/>permission denied"| fechado
    SVC(["chave de serviço"]) --> publico
    SVC --> fechado

    classDef aberto fill:#12261d,stroke:#2aa871,color:#dff5e9
    classDef trancado fill:#3d1f1f,stroke:#d9534f,color:#f5dede
    class publico aberto
    class fechado trancado
```

**Currículo fica fora de qualquer view pública.** Nem todo mundo quer que o
patrão atual descubra que está procurando emprego, e essa informação pode
custar o emprego que a pessoa ainda tem.

**Documento e selfie vão para bucket privado e são apagados na decisão do
admin.** Fica só o status no perfil — política de retenção da LGPD.

**Currículo em PDF nasce com URL assinada de um minuto.** O banco guarda o
caminho, não a URL; o link nasce a cada visita.

---

## 5. Como um upload atravessa o sistema

A ordem entre bucket e banco não é detalhe — é a diferença entre um arquivo
órfão invisível e uma imagem quebrada na tela.

```mermaid
sequenceDiagram
    participant P as Pessoa
    participant A as Server Action
    participant R as Regras
    participant S as Storage
    participant B as Postgres

    P->>A: arquivo
    A->>R: tipo e tamanho
    alt fora das regras
        R-->>P: recusa, dizendo o limite
    else dentro
        R->>A: caminho derivado<br/>do id da sessão
        A->>S: grava o arquivo
        Note over A,S: primeiro o arquivo
        A->>B: grava o caminho
        Note over A,B: se falhar aqui, sobra objeto órfão —<br/>invisível, e substituído no próximo envio.<br/>Na ordem inversa, o banco apontaria para<br/>arquivo inexistente e a tela quebraria.
        A-->>P: pronto
    end
```

**O caminho vem da sessão, nunca do nome enviado.** Nome vindo do cliente
permitiria `../` para escapar da pasta, ou o id de outra pessoa. Caminho
fixo por pessoa também faz a troca substituir o anterior, em vez de o bucket
virar depósito de versões pagas.

**Na remoção a ordem se inverte**, pelo mesmo raciocínio.

---

## 6. O que acontece quando cada peça cai

| Peça | Efeito | Por que é assim |
|---|---|---|
| Supabase Postgres | App fora do ar para quem tem sessão | A camada de dados falha alto de propósito: cair para dados de exemplo faria o app mostrar prestador que não existe, com telefone discável — já aconteceu |
| Supabase Storage | Envio recusado com aviso; o resto funciona | Aceitar em silêncio faria a pessoa achar que salvou |
| Sentry | Nada muda para o usuário | Envio é assíncrono e opcional |
| Vercel | Site fora | Sem plano B hoje; aceitável no piloto |
| API do IBGE | Nada muda | A lista de municípios é gerada em desenvolvimento e versionada — cadastro não depende de API de terceiro |
| Contagem de visualização | Vai para o log, a página abre | Quem abriu a vaga quer ler a vaga; a métrica é do outro lado do balcão |

---

## 7. Variáveis de ambiente

| Variável | Onde vive | Sem ela |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | navegador e servidor | modo demonstração |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navegador e servidor | modo demonstração |
| `SUPABASE_SERVICE_ROLE_KEY` | **só servidor** | erro claro em vez de RLS confusa |
| `SESSION_SECRET` | só servidor | produção recusa subir |
| `NEXT_PUBLIC_SENTRY_DSN` | navegador | nada é enviado |

`SUPABASE_SERVICE_ROLE_KEY` nunca leva prefixo `NEXT_PUBLIC_` — com o
prefixo, o Next a embute no bundle e ela deixa de ser secreta. Há teste
travando isso, e o módulo que a lê tem `server-only` no topo: importá-lo de
um componente de cliente quebra o build, que é muito melhor do que a chave
vazar.

---

## 8. O que não existe, de propósito

- **Chat interno.** O contato acontece por deep link `wa.me`. Decisão de
  produto do V0.
- **Websocket.** O painel do admin usa polling de 15 s. Conexão aberta em
  serverless exige um serviço à parte, com custo e mais uma peça para
  quebrar.
- **Captcha.** Atrapalha exatamente este público — aparelho antigo, dado
  móvel contado, pouca familiaridade digital.
- **Cloudflare na frente da Vercel.** A Vercel já entrega CDN e TLS; o que
  o Cloudflare somaria — WAF e rate limit na borda — só paga quando
  aparecer abuso que o limite atual não segura. O passo antes desse é um
  contador durável no Postgres, sem acrescentar fornecedor.
- **Busca vetorial.** `pgvector` existe no Supabase, mas com dezenas de
  prestadores numa cidade uma tabela de sinônimos resolve quase tudo por
  uma fração do custo e sem chamada externa no caminho da página.
