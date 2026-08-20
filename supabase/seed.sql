-- ============================================================================
-- LUPA — dados de desenvolvimento
--
-- SOMENTE PARA AMBIENTE LOCAL / DE TESTES. Insere direto em auth.users, o que
-- só funciona no Supabase local (`supabase start`) ou em instância própria.
-- Nunca rode isto em produção.
--
--   supabase db reset      # aplica schema.sql e depois este arquivo
--
-- É um subconjunto representativo dos dados de demonstração de
-- src/lib/mock-data.ts — o suficiente para exercitar busca, filtros,
-- candidatura, avaliação e o painel da empresa.
-- ============================================================================

-- Senha de todos os usuários de teste: lupa1234
-- (hash bcrypt fixo, gerado para este seed)
do $$
declare
  pwd text := crypt('lupa1234', gen_salt('bf'));
  users jsonb := '[
    {"id":"11111111-1111-4111-8111-000000000001","email":"joao@teste.lupa","name":"João Silva","phone":"66999110001","role":"prestador_servico","hood":"Jardim Botânico"},
    {"id":"11111111-1111-4111-8111-000000000002","email":"carlos@teste.lupa","name":"Carlos Souza","phone":"66999110002","role":"prestador_servico","hood":"Centro"},
    {"id":"11111111-1111-4111-8111-000000000003","email":"marcos@teste.lupa","name":"Marcos Lima","phone":"66999110003","role":"prestador_servico","hood":"Jardim das Palmeiras"},
    {"id":"11111111-1111-4111-8111-000000000004","email":"anapaula@teste.lupa","name":"Ana Paula Ribeiro","phone":"66999110005","role":"prestador_servico","hood":"Jardim Celeste"},
    {"id":"22222222-2222-4222-8222-000000000001","email":"agronorte@teste.lupa","name":"Luiz Fernando","phone":"6635110001","role":"empresa","hood":"Setor Industrial"},
    {"id":"22222222-2222-4222-8222-000000000002","email":"comercial@teste.lupa","name":"Regina Alves","phone":"6635110002","role":"empresa","hood":"Centro"},
    {"id":"33333333-3333-4333-8333-000000000001","email":"everton@teste.lupa","name":"Everton Rodrigues","phone":"66999220001","role":"candidato_clt","hood":"Jardim Primavera"},
    {"id":"33333333-3333-4333-8333-000000000002","email":"simone@teste.lupa","name":"Simone Batista","phone":"66999220002","role":"candidato_clt","hood":"Menezes"}
  ]'::jsonb;
  u jsonb;
begin
  for u in select * from jsonb_array_elements(users) loop
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    )
    values (
      (u ->> 'id')::uuid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      u ->> 'email',
      pwd,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'full_name',    u ->> 'name',
        'phone',        u ->> 'phone',
        'role',         u ->> 'role',
        'city',         'Sinop',
        'neighborhood', u ->> 'hood'
      ),
      now(), now()
    )
    on conflict (id) do nothing;
  end loop;
end $$;

-- O trigger handle_new_user já criou as linhas em `profiles`.
-- Marcamos como verificados os que aparecem com selo na demonstração.
update profiles
set phone_verified = true,
    doc_verified = true,
    verification_status = 'aprovado'
where id in (
  '11111111-1111-4111-8111-000000000001',
  '11111111-1111-4111-8111-000000000002',
  '11111111-1111-4111-8111-000000000003',
  '11111111-1111-4111-8111-000000000004',
  '22222222-2222-4222-8222-000000000001',
  '22222222-2222-4222-8222-000000000002'
);

-- ----------------------------------------------------------------------------
-- Prestadores de serviço
-- ----------------------------------------------------------------------------

insert into provider_profiles
  (profile_id, category_id, description, starting_price, years_experience, service_area)
values
  ('11111111-1111-4111-8111-000000000001', 1,
   'Trabalho com instalações elétricas residenciais e comerciais, manutenção preventiva, troca de quadro de disjuntores e reparos em geral. Atendo Sinop e região com orçamento sem compromisso.',
   150, 7, array['Centro','Jardim Botânico','Jardim Paraíso','Menezes']),
  ('11111111-1111-4111-8111-000000000002', 4,
   'Encanador com atendimento de emergência. Conserto de vazamentos, desentupimento, instalação de caixa d''água, aquecedor e louças sanitárias. Atendo também aos finais de semana.',
   120, 12, array['Centro','Setor Comercial','Jardim Itália']),
  ('11111111-1111-4111-8111-000000000003', 3,
   'Pintura residencial e comercial, textura, grafiato e massa corrida. Faço o serviço completo, da preparação da parede à limpeza final. Orçamento por metro quadrado.',
   200, 9, array['Jardim das Palmeiras','Residencial Florença','Centro']),
  ('11111111-1111-4111-8111-000000000004', 2,
   'Diarista com referências. Faxina completa, limpeza pesada pós-obra e organização de armários. Levo meu próprio material de limpeza se preferir. Disponível de segunda a sábado.',
   140, 6, array['Jardim Celeste','Centro','Aquarela Brasil'])
on conflict (profile_id) do nothing;

-- ----------------------------------------------------------------------------
-- Empresas
-- ----------------------------------------------------------------------------

insert into companies (profile_id, company_name, cnpj, plan) values
  ('22222222-2222-4222-8222-000000000001', 'Agro Norte Ltda.', '12345678000190', 'mensal'),
  ('22222222-2222-4222-8222-000000000002', 'Comercial Sinop',  '23456789000101', 'trial')
on conflict (profile_id) do nothing;

-- ----------------------------------------------------------------------------
-- Candidato CLT
-- ----------------------------------------------------------------------------

insert into clt_profiles (profile_id, desired_area, education, skills, availability) values
  ('33333333-3333-4333-8333-000000000001', 'Agronegócio', 'Ensino médio completo',
   array['CNH categoria C','Colheitadeira','Trator'], 'Imediata'),
  ('33333333-3333-4333-8333-000000000002', 'Indústria e Produção', 'Ensino fundamental completo',
   array['Operação de empilhadeira','Trabalho em turnos'], 'A partir do próximo mês')
on conflict (profile_id) do nothing;

-- ----------------------------------------------------------------------------
-- Vagas
-- ----------------------------------------------------------------------------

insert into jobs
  (id, company_id, title, description, category, city, neighborhood,
   contract_type, salary_min, salary_max, status, created_at)
values
  ('44444444-4444-4444-8444-000000000001',
   '22222222-2222-4222-8222-000000000001',
   'Operador de Máquinas Agrícolas',
   E'Operação de colheitadeiras e tratores em lavoura de soja e milho. Responsável pela regulagem do equipamento, checagem diária de óleo e filtros, e registro de horas trabalhadas.\n\nRequisitos: CNH categoria C, experiência comprovada com colheitadeira, disponibilidade para trabalhar em fazenda durante a safra.\n\nOferecemos: alojamento na fazenda, alimentação, transporte de Sinop até a propriedade e adicional de safra.',
   'Agronegócio', 'Sinop', 'Setor Industrial', 'CLT', 3200, 4200, 'aberta', now() - interval '2 hours'),

  ('44444444-4444-4444-8444-000000000002',
   '22222222-2222-4222-8222-000000000002',
   'Auxiliar Administrativo',
   E'Rotinas administrativas do escritório: emissão de notas fiscais, controle de contas a pagar e receber, atendimento telefônico e organização de documentos.\n\nRequisitos: ensino médio completo, pacote Office intermediário, boa comunicação escrita.\n\nHorário comercial, de segunda a sexta. Vale-transporte e vale-refeição.',
   'Administrativo', 'Sinop', 'Centro', 'CLT', 1800, 2200, 'aberta', now() - interval '4 hours'),

  ('44444444-4444-4444-8444-000000000003',
   '22222222-2222-4222-8222-000000000001',
   'Auxiliar de Produção',
   E'Apoio na linha de beneficiamento de grãos: abastecimento de máquinas, ensaque, paletização e limpeza do setor.\n\nRequisitos: ensino fundamental completo, disponibilidade para turnos.\n\nAdicional noturno para o turno da madrugada. Transporte fretado saindo do Centro de Sinop.',
   'Indústria e Produção', 'Sinop', 'Setor Industrial', 'CLT', 1650, 1900, 'aberta', now() - interval '1 day'),

  ('44444444-4444-4444-8444-000000000004',
   '22222222-2222-4222-8222-000000000001',
   'Estágio em Agronomia',
   E'Acompanhamento de campo junto ao time agronômico: monitoramento de pragas, coleta de amostras de solo e registro de dados de lavoura.\n\nRequisitos: cursando a partir do 5º semestre de Agronomia, CNH B.\n\nBolsa-auxílio mais vale-transporte. Possibilidade de efetivação.',
   'Agronegócio', 'Sinop', 'Setor Industrial', 'Estágio', 1200, null, 'aberta', now() - interval '4 days')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Candidaturas
-- ----------------------------------------------------------------------------

insert into applications (job_id, candidate_id, status, created_at) values
  ('44444444-4444-4444-8444-000000000001', '33333333-3333-4333-8333-000000000001', 'enviada',     now() - interval '1 hour'),
  ('44444444-4444-4444-8444-000000000003', '33333333-3333-4333-8333-000000000002', 'visualizada', now() - interval '9 hours')
on conflict (job_id, candidate_id) do nothing;

-- ----------------------------------------------------------------------------
-- Avaliações (o trigger recalcula avg_rating e review_count)
-- ----------------------------------------------------------------------------

insert into reviews (provider_id, reviewer_name, rating, comment, created_at) values
  ('11111111-1111-4111-8111-000000000001', 'Ana Paula',   5, 'Excelente profissional! Pontual, educado e serviço de qualidade.', now() - interval '3 days'),
  ('11111111-1111-4111-8111-000000000001', 'Roberto M.',  5, 'Fez toda a parte elétrica da minha reforma. Preço justo.',        now() - interval '11 days'),
  ('11111111-1111-4111-8111-000000000001', 'Camila S.',   4, 'Bom serviço. Atrasou um pouco no dia, mas avisou antes.',         now() - interval '24 days'),
  ('11111111-1111-4111-8111-000000000002', 'Marta O.',    5, 'Chamei num domingo por causa de um vazamento e ele veio no mesmo dia.', now() - interval '8 days'),
  ('11111111-1111-4111-8111-000000000002', 'Jonas T.',    5, 'Desentupiu a pia e explicou como evitar. Cobrou o combinado.',    now() - interval '17 days'),
  ('11111111-1111-4111-8111-000000000003', 'Fernanda L.', 5, 'Pintou a casa inteira em 4 dias. Acabamento impecável.',          now() - interval '6 days'),
  ('11111111-1111-4111-8111-000000000003', 'Diego R.',    5, 'Recomendo. Orçamento fechado, sem surpresa no final.',            now() - interval '19 days'),
  ('11111111-1111-4111-8111-000000000004', 'Juliana T.',  5, 'Melhor diarista que já contratei em Sinop.',                      now() - interval '2 days'),
  ('11111111-1111-4111-8111-000000000004', 'Sônia W.',    5, 'Pontual, honesta e organizada. Já é fixa aqui em casa.',          now() - interval '22 days');

-- ----------------------------------------------------------------------------
-- Fila de verificação + admin
-- ----------------------------------------------------------------------------

insert into verification_requests (profile_id, status, submitted_at) values
  ('33333333-3333-4333-8333-000000000001', 'em_analise', now() - interval '3 hours');

-- Fundador como admin do painel de verificações.
insert into admins (profile_id)
values ('22222222-2222-4222-8222-000000000001')
on conflict (profile_id) do nothing;
