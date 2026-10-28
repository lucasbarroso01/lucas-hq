insert into teams (id, nome, cor, operacao) values
  ('radar', 'Radar', '#3B6FE0', 'maquina-viral'),
  ('roteiros', 'Roteiros', '#E9B23A', 'maquina-viral'),
  ('producao-wf', 'Produção Worldframe', '#7B5CE0', 'maquina-viral'),
  ('producao-pets', 'Produção Funny Pets', '#E5893B', 'maquina-viral'),
  ('qualidade', 'Qualidade', '#2BB673', 'maquina-viral'),
  ('social', 'Social & Agenda', '#D94BC8', 'maquina-viral'),
  ('analytics', 'Analytics', '#22B8C9', 'maquina-viral'),
  ('inbox-b2b', 'Inbox B2B', '#D9474B', 'agencia-lucas'),
  ('criacao-b2b', 'Criação B2B', '#9A5CF0', 'agencia-lucas')
on conflict (id) do update set nome = excluded.nome, cor = excluded.cor, operacao = excluded.operacao;

insert into agents (id, team_id, nome, papel, is_lead) values
  ('radar-worldframe', 'radar', 'radar-worldframe', 'Pesquisa temas virais (Worldframe)', true),
  ('radar-pets', 'radar', 'radar-pets', 'Pesquisa virais de pets (pasta de modelagem)', false),
  ('roteirista-lead', 'roteiros', 'roteirista-lead', 'Líder de roteiros', true),
  ('roteirista', 'roteiros', 'roteirista', 'Sub-agente de ganchos', false),
  ('editor-lead', 'producao-wf', 'editor-lead', 'Divide os 5 vídeos em sub-agentes', true),
  ('video-editor', 'producao-wf', 'video-editor', 'Editor (corte, legenda, capa)', false),
  ('pets-producer', 'producao-pets', 'pets-producer', 'Gera cenas no Higgsfield após aprovação', true),
  ('brand-checker', 'qualidade', 'brand-checker', 'QA pela folha de contato (nota ≥ 8)', true),
  ('social-scheduler', 'social', 'social-scheduler', 'Sobe no Drive e define horários', true),
  ('analista', 'analytics', 'analista', 'Registra views e lições', true),
  ('briefing', 'inbox-b2b', 'briefing', 'Transforma pedido em briefing', true),
  ('roteirista-b2b', 'criacao-b2b', 'roteirista-b2b', 'Roteiros e formatos para clientes', true)
on conflict (id) do update set team_id = excluded.team_id, papel = excluded.papel, is_lead = excluded.is_lead;

insert into skills_runtime (team_id, skill) values
  ('radar', 'trend-scan'), ('radar', 'drive-modelagem'),
  ('roteiros', 'faceless-video-direction'), ('roteiros', 'ig-reel-scripts'),
  ('producao-wf', 'faceless-video-direction'), ('producao-wf', 'hypit-video'), ('producao-wf', 'lemo-opuscar'),
  ('producao-wf', 'moneyprinterturbo-video'), ('producao-wf', 'hyperframes-video'),
  ('producao-pets', 'higgsfield'), ('producao-pets', 'faceless-video-direction'),
  ('qualidade', 'contact-sheet-qa'), ('social', 'instagram-marketing'), ('analytics', 'views-report'),
  ('inbox-b2b', 'briefing'), ('criacao-b2b', 'ig-reel-scripts'), ('criacao-b2b', 'copy-humana')
on conflict do nothing;
