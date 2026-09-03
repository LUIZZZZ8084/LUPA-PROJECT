# Roadmap

Visão geral do que está pronto e do que falta, para quem chega no
projeto sem ter acompanhado a conversa. Mantido por quem mexe no
código — humano ou agente — a cada mudança relevante. Para o
passo a passo de como contribuir, veja o [CONTRIBUTING.md](CONTRIBUTING.md).
Detalhe de arquitetura e o porquê de cada decisão está no
[AGENTS.md](AGENTS.md); o desenho do sistema, com diagramas, em
[docs/arquitetura.md](docs/arquitetura.md).

**Última atualização: 01/09/2026.**

## Concluído

Base:

- Autenticação própria (cadastro, login, sessão em JWT, RBAC por papel)
- App fechado por login, com 404 de verdade em vez de 403 onde faz
  sentido
- Perfil por papel (candidato CLT, prestador, empresa) com edição em
  `/perfil/editar`
- Envio de foto de perfil, currículo em PDF e logo de empresa, com
  caminho derivado da sessão
- Busca de vagas e de prestadores, com filtro por cidade, bairro e
  categoria
- Candidatura a vaga, e acompanhamento em "Minhas candidaturas"
- Publicações no perfil do prestador, com limite de 10 ativas
- Painel administrativo: fila de verificação manual, métricas básicas
- Schema único (`supabase/schema.sql`), executado por teste contra
  Postgres real
- Modo demonstração (roda sem Supabase configurado)
- Contraste WCAG AA em todas as rotas, com teste automático

Painel da empresa — completo, menos cobrança:

- Busca entre quem pediu para ser encontrado, com filtro por habilidade e
  área, e perfil do candidato —
  [#96](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/96),
  PR [#99](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/99)
- Estágio com o nome de quem lê ("Não visualizado" para o candidato,
  "Nova" para a empresa) e % de casamento na lista de currículos —
  [#95](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/95),
  PR [#97](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/97)
- "Quero que empresas me encontrem": consentimento do candidato, desligado
  por padrão, e proximidade no bloco de recomendados —
  [#83](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/83),
  PR [#84](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/84)
- Habilidades viram skills e o painel recomenda candidatos —
  [#73](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/73),
  PR [#74](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/74)
- Ficha do candidato e contato direto nos currículos recebidos —
  [#71](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/71),
  PR [#72](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/72)

- Publicar, editar e encerrar vaga —
  [#43](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/43),
  PR [#51](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/51)
- Mover candidatura entre estágios —
  [#44](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/44),
  PR [#58](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/58)
- Métricas por dia, com dado real —
  [#45](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/45),
  PR [#59](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/59)

Alcance:

- Mato Grosso inteiro, começando por Sinop: os 142 municípios valem no
  cadastro, na vaga e nos filtros —
  [#62](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/62),
  PR [#63](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/63)
- Vaga publicada fora de Sinop sumia da busca: a tela chutava a cidade
  quando a URL não trazia nenhuma —
  [#76](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/76),
  PR [#77](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/77)
- O mais perto de quem está olhando aparece primeiro, por região do IBGE —
  [#79](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/79)
- Título e descrição de `/vagas` e `/servicos` acompanham a cidade
  filtrada, em vez de dizer Sinop sempre —
  [#78](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/78)

Prestador:

- Virar prestador completa o perfil que já existe, em vez de pedir conta
  nova — com aviso do que a troca de papel custa —
  [#112](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/112)
- A busca de serviços só mostra quem passou pela verificação; o perfil
  continua alcançável e diz que está em análise —
  [#114](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/114)
- O feed de trabalhos do prestador, que tinha backend e nenhuma tela — e
  o atalho do perfil que apontava para a busca pública —
  [#115](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/115)

Perfil e vaga, o que cada um informa:

- Endereço na vaga, aditivo ao bairro e fora do ranking —
  [#86](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/86),
  PR [#87](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/87)
- Instagram e Facebook para empresa e prestador; o `site`, que existia e
  nunca aparecia, passa a aparecer —
  [#92](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/92),
  PR [#94](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/94)
- "Local" da vaga dizia só o bairro, sem a cidade — ambíguo com o estado
  inteiro aberto —
  [#88](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/88),
  PR [#89](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/89)
- Empresa via campo de foto pessoal que não usa, e o envio morria acima de
  1 MB — o limite do framework era menor que o anunciado —
  [#90](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/90),
  PR [#91](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/91)

Segurança (auditoria dos 20 pontos, em duas passadas):

- Views sensíveis vazavam pela chave anônima —
  [#52](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/52),
  PR [#53](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/53)
- Termo de busca injetava condição no filtro do PostgREST —
  [#54](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/54),
  PR [#56](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/56)
- CSP, limite no cadastro e varredura de dependências na CI —
  [#55](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/55),
  PR [#57](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/57)
- View faltando derrubava "Minhas candidaturas" em produção; tabelas
  sensíveis sem `revoke` —
  [#64](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/64),
  PR [#65](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/65)

Decisões futuras, com dado em vez de palpite:

- Limite de tentativa durável no Postgres —
  [#67](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/67),
  PR [#86](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/86)
- Registrar busca sem resultado, para decidir sobre busca semântica —
  [#66](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/66),
  PR [#85](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/85)

Qualidade:

- Score de mutação de 59,4% para 71,6%, com o piso onde estava —
  [#60](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/60),
  PR [#61](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/61)
- Arquitetura desenhada em `docs/arquitetura.md`
- Envio de foto, currículo e logo conferido em produção, com conta real —
  [#70](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/70). A
  conferência achou o caminho quebrado acima de 1 MB, corrigido em
  PR [#91](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/91)
- Manifesto do PWA era barrado pelo muro de login, e o app deixava de ser
  instalável para quem ainda não tem conta —
  [#98](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/98),
  PR [#100](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/100)

## Pendente

**Tudo o que sobrou vai junto com o empacotamento em APK.** Decisão do
Luiz em 01/09/2026, que reúne numa etapa só o que antes estava espalhado.
Nada aqui está bloqueado por código.

- [ ] Notificação push por cidade e categoria —
      [#48](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/48)

      Espera o APK por razão técnica: o caminho é PWA → Capacitor
      (`docs/brief-tecnico.md`, seção 12), e no Android o Capacitor usa
      Firebase Cloud Messaging. Fazer agora com Web Push puro seria
      construir duas vezes.

- [ ] Cobrança via Mercado Pago (planos trial/mensal) —
      [#46](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/46)

      Espera por razão de produto, decidida em 25/08 e mantida:
      *pagamento é a última etapa*. Validar demanda antes de cobrar.

- [ ] Gerador de currículo pago — depende do #46 —
      [#47](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/47)

## Depende de decisão, não de código

| O que | Quem decide | Por que está parado |
|---|---|---|
| Conta do Mercado Pago | Luiz | Sem credencial não há como integrar |
| Provedor de push (#48) | Luiz | Resolvido junto com o APK: Firebase, que o Capacitor usa no Android |
| Cloudflare | Luiz | Só com abuso real medido — o passo antes é o #67 |
| Busca vetorial | Luiz | Só com o dado do #66 na mão |

## Depende de uma ação manual

Trabalho que não é código: alguém precisa fazer com a mão, em produção.

- [ ] Trocar a senha de admin —
      [#69](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/69)

      **Sem urgência**, decidido em 01/09/2026: só o Luiz e o Paulinho
      operam a conta. Não há senha de admin no repositório — o
      `criar-admin.mjs` lê do ambiente ou gera uma. O que a Issue trata é
      que duas senhas passaram por conversa de chat em 25/08, então a
      garantia se perdeu; não há indício de vazamento.

## Fora do escopo por decisão, não por esquecimento

Testes e triagem automática, múltiplos usuários por empresa, chat interno
e proteção por captcha. O porquê de cada um está no AGENTS.md.

Sincronizar os componentes com o Claude Design —
[#75](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/75), fechada em
01/09/2026 sem fazer. O `.gitignore` continua ignorando `.ds-sync/`,
`.design-sync/`, `dist/` e `ds-bundle/`, que é o rastro da ferramenta ter
rodado uma vez.

Busca de candidatos saiu desta lista em 31/08/2026: `/candidatos` existe,
e o que a sustenta é o consentimento do candidato, não o afrouxamento da
razão que a mantinha fora.
