# Roadmap

Visão geral do que está pronto e do que falta, para quem chega no
projeto sem ter acompanhado a conversa. Mantido por quem mexe no
código — humano ou agente — a cada mudança relevante. Para o
passo a passo de como contribuir, veja o [CONTRIBUTING.md](CONTRIBUTING.md).
Detalhe de arquitetura e o porquê de cada decisão está no
[AGENTS.md](AGENTS.md); o desenho do sistema, com diagramas, em
[docs/arquitetura.md](docs/arquitetura.md).

**Última atualização: 25/08/2026.**

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

Qualidade:

- Score de mutação de 59,4% para 71,6%, com o piso onde estava —
  [#60](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/60),
  PR [#61](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/61)
- Arquitetura desenhada em `docs/arquitetura.md`

## Pendente

Ordem definida pelo Luiz em 25/08/2026: **pagamento é a última etapa.**

Antes disso, e sem depender de decisão nova:

- [ ] Registrar busca sem resultado, para decidir sobre busca semântica —
      [#66](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/66)
- [ ] Limite de tentativa durável no Postgres —
      [#67](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/67)
- [ ] Notificação push por bairro e categoria —
      [#48](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/48)

Por último, na ordem:

- [ ] Cobrança via Mercado Pago (planos trial/mensal) —
      [#46](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/46)
- [ ] Gerador de currículo pago — depende do #46 —
      [#47](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/47)

## Depende de decisão, não de código

| O que | Quem decide | Por que está parado |
|---|---|---|
| Conta do Mercado Pago | Luiz | Sem credencial não há como integrar |
| Provedor de push (#48) | Luiz | Escolha de fornecedor e custo |
| Cloudflare | Luiz | Só com abuso real medido — o passo antes é o #67 |
| Busca vetorial | Luiz | Só com o dado do #66 na mão |

## Depende de uma ação manual

Trabalho que não é código: alguém precisa fazer com a mão, em produção.

- [ ] Trocar a senha de admin —
      [#69](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/69)
- [ ] Conferir envio de foto, currículo e logo em produção —
      [#70](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/70)

## Fora do escopo por decisão, não por esquecimento

Banco de talentos com busca ativa de candidatos, testes e triagem
automática, múltiplos usuários por empresa, chat interno e proteção por
captcha. O porquê de cada um está no AGENTS.md.
