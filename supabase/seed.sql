-- ============================================================================
-- LUPA — dados de exemplo de Sinop
--
-- Rode DEPOIS de schema.sql, num banco vazio.
--
-- Serve para a plataforma não abrir vazia enquanto não houver cadastro de
-- verdade. NÃO rode em produção depois que existir usuário real: os e-mails
-- e os CNPJs colidiriam com os índices únicos.
--
-- Senha de todas as contas: lupa1234
--
-- Os avatares vêm de public/avatares, gerados pelo DiceBear a partir de
-- coleções em domínio público (CC0) — ver scripts/gerar-avatares.mjs.
-- Nenhuma foto de pessoa real.
--
-- Este arquivo é executado por teste automatizado contra um Postgres real
-- (tests/unit/schema.test.ts), junto com o schema.
-- ============================================================================

begin;

-- Ids fixos: o seed precisa ser idempotente de conferir e as views precisam
-- de algo estável para os testes apontarem.
insert into usuarios
  (id, email, senha_hash, papel, nome_completo, telefone, cidade, bairro,
   avatar_url, telefone_verificado, doc_verificado, status_verificacao)
values
  ('11111111-1111-4111-8111-000000000001', 'joao@teste.lupa',     '$argon2id$v=19$m=19456,t=2,p=1$c2VlZHNhbHQxMjM0NTY3OA$K1YvZ3hQb0JmRDRuUjd3TDJtQjR0RDZzRjloSzBhQzVlRzhqTjFwUTI', 'prestador_servico', 'João Silva',        '66999110001', 'Sinop', 'Jardim Botânico',      '/avatares/prv-joao-silva.svg',       true, true,  'aprovado'),
  ('11111111-1111-4111-8111-000000000002', 'carlos@teste.lupa',   '$argon2id$v=19$m=19456,t=2,p=1$c2VlZHNhbHQxMjM0NTY3OA$K1YvZ3hQb0JmRDRuUjd3TDJtQjR0RDZzRjloSzBhQzVlRzhqTjFwUTI', 'prestador_servico', 'Carlos Souza',      '66999110002', 'Sinop', 'Centro',               '/avatares/prv-carlos-souza.svg',     true, true,  'aprovado'),
  ('11111111-1111-4111-8111-000000000003', 'marcos@teste.lupa',   '$argon2id$v=19$m=19456,t=2,p=1$c2VlZHNhbHQxMjM0NTY3OA$K1YvZ3hQb0JmRDRuUjd3TDJtQjR0RDZzRjloSzBhQzVlRzhqTjFwUTI', 'prestador_servico', 'Marcos Lima',       '66999110003', 'Sinop', 'Jardim das Palmeiras', '/avatares/prv-marcos-lima.svg',      true, true,  'aprovado'),
  ('11111111-1111-4111-8111-000000000004', 'jose@teste.lupa',     '$argon2id$v=19$m=19456,t=2,p=1$c2VlZHNhbHQxMjM0NTY3OA$K1YvZ3hQb0JmRDRuUjd3TDJtQjR0RDZzRjloSzBhQzVlRzhqTjFwUTI', 'prestador_servico', 'José Moreira',      '66999110004', 'Sinop', 'Jardim Primavera',     '/avatares/prv-jose-moreira.svg',     true, false, 'em_analise'),
  ('11111111-1111-4111-8111-000000000005', 'anapaula@teste.lupa', '$argon2id$v=19$m=19456,t=2,p=1$c2VlZHNhbHQxMjM0NTY3OA$K1YvZ3hQb0JmRDRuUjd3TDJtQjR0RDZzRjloSzBhQzVlRzhqTjFwUTI', 'prestador_servico', 'Ana Paula Ribeiro', '66999110005', 'Sinop', 'Jardim Celeste',       '/avatares/prv-ana-paula.svg',        true, true,  'aprovado'),
  ('11111111-1111-4111-8111-000000000006', 'rosa@teste.lupa',     '$argon2id$v=19$m=19456,t=2,p=1$c2VlZHNhbHQxMjM0NTY3OA$K1YvZ3hQb0JmRDRuUjd3TDJtQjR0RDZzRjloSzBhQzVlRzhqTjFwUTI', 'prestador_servico', 'Rosa Mendes',       '66999110006', 'Sinop', 'Menezes',              '/avatares/prv-rosa-mendes.svg',      true, true,  'aprovado'),
  ('11111111-1111-4111-8111-000000000007', 'pedro@teste.lupa',    '$argon2id$v=19$m=19456,t=2,p=1$c2VlZHNhbHQxMjM0NTY3OA$K1YvZ3hQb0JmRDRuUjd3TDJtQjR0RDZzRjloSzBhQzVlRzhqTjFwUTI', 'prestador_servico', 'Pedro Alves',       '66999110007', 'Sinop', 'Boa Esperança',        '/avatares/prv-pedro-alves.svg',      true, false, 'em_analise'),
  ('11111111-1111-4111-8111-000000000008', 'luciana@teste.lupa',  '$argon2id$v=19$m=19456,t=2,p=1$c2VlZHNhbHQxMjM0NTY3OA$K1YvZ3hQb0JmRDRuUjd3TDJtQjR0RDZzRjloSzBhQzVlRzhqTjFwUTI', 'prestador_servico', 'Luciana Costa',     '66999110008', 'Sinop', 'Aquarela Brasil',      '/avatares/prv-luciana-costa.svg',    true, true,  'aprovado'),
  ('11111111-1111-4111-8111-000000000009', 'antonio@teste.lupa',  '$argon2id$v=19$m=19456,t=2,p=1$c2VlZHNhbHQxMjM0NTY3OA$K1YvZ3hQb0JmRDRuUjd3TDJtQjR0RDZzRjloSzBhQzVlRzhqTjFwUTI', 'prestador_servico', 'Antônio Ferreira',  '66999110009', 'Sinop', 'Setor Comercial',      '/avatares/prv-antonio-ferreira.svg', true, true,  'aprovado'),

  ('22222222-2222-4222-8222-000000000001', 'agronorte@teste.lupa',  '$argon2id$v=19$m=19456,t=2,p=1$c2VlZHNhbHQxMjM0NTY3OA$K1YvZ3hQb0JmRDRuUjd3TDJtQjR0RDZzRjloSzBhQzVlRzhqTjFwUTI', 'empresa', 'Luiz Fernando', '6635110001', 'Sinop', 'Setor Industrial', '/avatares/cmp-agro-norte.svg',          true, true, 'aprovado'),
  ('22222222-2222-4222-8222-000000000002', 'comercial@teste.lupa',  '$argon2id$v=19$m=19456,t=2,p=1$c2VlZHNhbHQxMjM0NTY3OA$K1YvZ3hQb0JmRDRuUjd3TDJtQjR0RDZzRjloSzBhQzVlRzhqTjFwUTI', 'empresa', 'Regina Alves',  '6635110002', 'Sinop', 'Centro',           '/avatares/cmp-comercial-sinop.svg',     true, true, 'aprovado'),
  ('22222222-2222-4222-8222-000000000003', 'construcao@teste.lupa', '$argon2id$v=19$m=19456,t=2,p=1$c2VlZHNhbHQxMjM0NTY3OA$K1YvZ3hQb0JmRDRuUjd3TDJtQjR0RDZzRjloSzBhQzVlRzhqTjFwUTI', 'empresa', 'Mário Becker',  '6635110003', 'Sinop', 'Setor Comercial',  '/avatares/cmp-casa-construcao.svg',     true, true, 'aprovado'),

  ('33333333-3333-4333-8333-000000000001', 'everton@teste.lupa', '$argon2id$v=19$m=19456,t=2,p=1$c2VlZHNhbHQxMjM0NTY3OA$K1YvZ3hQb0JmRDRuUjd3TDJtQjR0RDZzRjloSzBhQzVlRzhqTjFwUTI', 'candidato_clt', 'Everton Rodrigues', '66999220001', 'Sinop', 'Jardim Primavera', '/avatares/cnd-everton-rodrigues.svg', true, false, 'pendente'),
  ('33333333-3333-4333-8333-000000000002', 'simone@teste.lupa',  '$argon2id$v=19$m=19456,t=2,p=1$c2VlZHNhbHQxMjM0NTY3OA$K1YvZ3hQb0JmRDRuUjd3TDJtQjR0RDZzRjloSzBhQzVlRzhqTjFwUTI', 'candidato_clt', 'Simone Batista',    '66999220002', 'Sinop', 'Menezes',          '/avatares/cnd-simone-batista.svg',    true, false, 'pendente');

-- ----------------------------------------------------------------------------
-- Perfis de prestador
-- ----------------------------------------------------------------------------

insert into perfis_prestador
  (usuario_id, categoria_id, descricao, preco_inicial, anos_experiencia, bairros_atendidos)
values
  ('11111111-1111-4111-8111-000000000001', 1, 'Instalações elétricas residenciais e comerciais, manutenção preventiva, troca de quadro de disjuntores e reparos em geral. Atendo Sinop e região com orçamento sem compromisso.', 150, 7,  array['Centro','Jardim Botânico','Jardim Paraíso','Menezes']),
  ('11111111-1111-4111-8111-000000000002', 4, 'Encanador com atendimento de emergência. Conserto de vazamentos, desentupimento, instalação de caixa d''água, aquecedor e louças sanitárias. Atendo também aos finais de semana.', 120, 12, array['Centro','Setor Comercial','Jardim Itália']),
  ('11111111-1111-4111-8111-000000000003', 3, 'Pintura residencial e comercial, textura, grafiato e massa corrida. Faço o serviço completo, da preparação da parede à limpeza final.', 200, 9,  array['Jardim das Palmeiras','Residencial Florença','Centro']),
  ('11111111-1111-4111-8111-000000000004', 5, 'Pedreiro para obras pequenas e médias: alvenaria, reboco, contrapiso, assentamento de piso e azulejo. Trabalho com ajudante próprio.', 180, 15, array['Jardim Primavera','Boa Esperança','Jacarandá']),
  ('11111111-1111-4111-8111-000000000005', 2, 'Diarista com referências. Faxina completa, limpeza pesada pós-obra e organização de armários. Levo meu próprio material se preferir.', 140, 6,  array['Jardim Celeste','Centro','Aquarela Brasil']),
  ('11111111-1111-4111-8111-000000000006', 7, 'Cuidadora de idosos com curso técnico e experiência hospitalar. Acompanhamento em casa ou no hospital, medicação por horário e apoio na higiene.', 180, 8,  array['Menezes','Centro','Jardim Botânico']),
  ('11111111-1111-4111-8111-000000000007', 6, 'Manutenção de jardim, corte de grama, poda de árvores e cerca viva, plantio e adubação. Atendo casas e condomínios.', 100, 5,  array['Boa Esperança','Residencial Florença','Jardim Itália']),
  ('11111111-1111-4111-8111-000000000008', 2, 'Faxina residencial e limpeza de escritório. Trabalho por diária ou duas vezes por semana com valor fechado.', 130, 4,  array['Aquarela Brasil','Jardim Paraíso','Setor Comercial']),
  ('11111111-1111-4111-8111-000000000009', 1, 'Eletricista especializado em ar-condicionado split: instalação, limpeza, recarga de gás e manutenção. Também faço rede elétrica para climatização.', 220, 11, array['Setor Comercial','Centro','Setor Industrial']);

-- ----------------------------------------------------------------------------
-- Perfis de empresa
-- ----------------------------------------------------------------------------

insert into perfis_empresa
  (usuario_id, razao_social, cnpj, setor, porte, descricao, logo_url, plano)
values
  ('22222222-2222-4222-8222-000000000001', 'Agro Norte Ltda.',  '11222333000181', 'Agronegócio',     'Média',   'Beneficiamento de grãos e produção de soja e milho no norte de Mato Grosso.', '/avatares/cmp-agro-norte.svg',      'mensal'),
  ('22222222-2222-4222-8222-000000000002', 'Comercial Sinop',   '11444777000161', 'Comércio',        'Pequena', 'Distribuidora de materiais de escritório e informática em Sinop.',            '/avatares/cmp-comercial-sinop.svg', 'trial'),
  ('22222222-2222-4222-8222-000000000003', 'Casa & Construção', '11555888000142', 'Construção Civil','Média',   'Loja de materiais de construção com entrega em toda a cidade.',               '/avatares/cmp-casa-construcao.svg', 'trial');

-- ----------------------------------------------------------------------------
-- Perfis de candidato
-- ----------------------------------------------------------------------------

insert into perfis_candidato
  (usuario_id, area_desejada, formacao, habilidades, disponibilidade)
values
  ('33333333-3333-4333-8333-000000000001', 'Agronegócio',          'Ensino médio completo',        array['CNH categoria C','Colheitadeira','Trator'],        'Imediata'),
  ('33333333-3333-4333-8333-000000000002', 'Indústria e Produção', 'Ensino fundamental completo',  array['Operação de empilhadeira','Trabalho em turnos'],   'A partir do próximo mês');

-- ----------------------------------------------------------------------------
-- Vagas
-- ----------------------------------------------------------------------------

insert into vagas
  (id, empresa_id, titulo, descricao, categoria, cidade, bairro, tipo_contrato,
   salario_min, salario_max, criado_em)
values
  ('44444444-4444-4444-8444-000000000001', '22222222-2222-4222-8222-000000000001',
   'Operador de Máquinas Agrícolas',
   E'Operação de colheitadeiras e tratores em lavoura de soja e milho.\n\nRequisitos: CNH categoria C, experiência comprovada, disponibilidade para trabalhar em fazenda durante a safra.\n\nOferecemos: alojamento, alimentação e adicional de safra.',
   'Agronegócio', 'Sinop', 'Setor Industrial', 'CLT', 3200, 4200, now() - interval '2 hours'),

  ('44444444-4444-4444-8444-000000000002', '22222222-2222-4222-8222-000000000002',
   'Auxiliar Administrativo',
   E'Rotinas administrativas do escritório: emissão de notas, contas a pagar e receber, atendimento e organização de documentos.\n\nRequisitos: ensino médio completo, pacote Office intermediário.\n\nHorário comercial. Vale-transporte e vale-refeição.',
   'Administrativo', 'Sinop', 'Centro', 'CLT', 1800, 2200, now() - interval '4 hours'),

  ('44444444-4444-4444-8444-000000000003', '22222222-2222-4222-8222-000000000001',
   'Auxiliar de Produção',
   E'Apoio na linha de beneficiamento de grãos: abastecimento de máquinas, ensaque, paletização e limpeza do setor.\n\nRequisitos: ensino fundamental completo, disponibilidade para turnos.\n\nAdicional noturno e transporte fretado.',
   'Indústria e Produção', 'Sinop', 'Setor Industrial', 'CLT', 1650, 1900, now() - interval '1 day'),

  ('44444444-4444-4444-8444-000000000004', '22222222-2222-4222-8222-000000000003',
   'Vendedor Interno — Material de Construção',
   E'Atendimento na loja, elaboração de orçamentos e acompanhamento de pedidos até a entrega.\n\nRequisitos: experiência em vendas no varejo.\n\nSalário fixo mais comissão, sem teto.',
   'Comércio e Vendas', 'Sinop', 'Setor Comercial', 'CLT', 1600, null, now() - interval '6 hours'),

  ('44444444-4444-4444-8444-000000000005', '22222222-2222-4222-8222-000000000001',
   'Estágio em Agronomia',
   E'Acompanhamento de campo: monitoramento de pragas, coleta de amostras de solo e registro de dados.\n\nRequisitos: cursando a partir do 5º semestre, CNH B.\n\nBolsa-auxílio e possibilidade de efetivação.',
   'Agronegócio', 'Sinop', 'Setor Industrial', 'Estágio', 1200, null, now() - interval '4 days');

-- ----------------------------------------------------------------------------
-- Candidaturas
-- ----------------------------------------------------------------------------

insert into candidaturas (vaga_id, candidato_id, status, criado_em) values
  ('44444444-4444-4444-8444-000000000001', '33333333-3333-4333-8333-000000000001', 'enviada',     now() - interval '1 hour'),
  ('44444444-4444-4444-8444-000000000003', '33333333-3333-4333-8333-000000000002', 'visualizada', now() - interval '9 hours');

-- ----------------------------------------------------------------------------
-- Avaliações
--
-- O trigger recalcula nota_media e total_avaliacoes a cada linha inserida.
-- ----------------------------------------------------------------------------

insert into avaliacoes (prestador_id, nome_avaliador, nota, comentario, criado_em) values
  ('11111111-1111-4111-8111-000000000001', 'Ana Paula',     5, 'Excelente profissional! Pontual, educado e serviço de qualidade.',            now() - interval '3 days'),
  ('11111111-1111-4111-8111-000000000001', 'Roberto M.',    5, 'Fez toda a parte elétrica da minha reforma. Preço justo.',                    now() - interval '11 days'),
  ('11111111-1111-4111-8111-000000000001', 'Camila S.',     4, 'Bom serviço. Atrasou um pouco no dia, mas avisou antes.',                     now() - interval '24 days'),
  ('11111111-1111-4111-8111-000000000002', 'Marta O.',      5, 'Chamei num domingo por causa de um vazamento e ele veio no mesmo dia.',       now() - interval '8 days'),
  ('11111111-1111-4111-8111-000000000002', 'Jonas T.',      5, 'Desentupiu a pia e explicou como evitar. Cobrou o combinado.',                now() - interval '17 days'),
  ('11111111-1111-4111-8111-000000000003', 'Fernanda L.',   5, 'Pintou a casa inteira em 4 dias. Acabamento impecável.',                      now() - interval '6 days'),
  ('11111111-1111-4111-8111-000000000003', 'Diego R.',      5, 'Recomendo. Orçamento fechado, sem surpresa no final.',                        now() - interval '19 days'),
  ('11111111-1111-4111-8111-000000000004', 'Sandra V.',     4, 'Serviço bem feito. O prazo estendeu por causa da chuva.',                     now() - interval '21 days'),
  ('11111111-1111-4111-8111-000000000005', 'Juliana T.',    5, 'Melhor diarista que já contratei em Sinop.',                                  now() - interval '2 days'),
  ('11111111-1111-4111-8111-000000000005', 'Sônia W.',      5, 'Pontual, honesta e organizada. Já é fixa aqui em casa.',                      now() - interval '22 days'),
  ('11111111-1111-4111-8111-000000000006', 'Paulo H.',      5, 'Cuidou da minha mãe por três meses com muito carinho.',                       now() - interval '14 days'),
  ('11111111-1111-4111-8111-000000000007', 'Condomínio Ipê',5, 'Faz a manutenção do jardim do condomínio todo mês. Sempre em dia.',           now() - interval '12 days'),
  ('11111111-1111-4111-8111-000000000008', 'Vanessa P.',    5, 'Limpa o escritório duas vezes por semana. Nunca deu problema.',               now() - interval '7 days'),
  ('11111111-1111-4111-8111-000000000009', 'Loja Girassol', 5, 'Instalou 4 splits na loja num sábado pra não parar o movimento.',             now() - interval '5 days'),
  ('11111111-1111-4111-8111-000000000009', 'Renata V.',     5, 'Limpeza e recarga de gás bem feitas. O ar voltou a gelar como novo.',         now() - interval '13 days');

-- ----------------------------------------------------------------------------
-- Publicações de perfil
-- ----------------------------------------------------------------------------

insert into publicacoes (autor_id, titulo, corpo) values
  ('11111111-1111-4111-8111-000000000001', 'Quadro de disjuntores novo no Jardim Botânico',
   'Troca completa do quadro, com disjuntores DR e aterramento. Serviço de meio período, sem quebrar parede.'),
  ('11111111-1111-4111-8111-000000000003', 'Grafiato na sala, antes e depois',
   'Preparação da parede, aplicação e limpeza final. Móveis protegidos do começo ao fim.'),
  ('22222222-2222-4222-8222-000000000001', 'Estamos contratando para a safra',
   'Vagas abertas para operador de máquinas e auxiliar de produção. Transporte fretado saindo do Centro de Sinop.');

-- ----------------------------------------------------------------------------
-- Fila de verificação
-- ----------------------------------------------------------------------------

insert into pedidos_verificacao (usuario_id, status, enviado_em) values
  ('11111111-1111-4111-8111-000000000004', 'em_analise', now() - interval '3 hours'),
  ('11111111-1111-4111-8111-000000000007', 'em_analise', now() - interval '20 hours');

commit;
