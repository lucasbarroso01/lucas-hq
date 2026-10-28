-- Lucas HQ · cole TUDO no SQL Editor do Supabase e clique em Run

-- Lucas HQ · schema + Realtime
create table if not exists teams (
  id text primary key,
  nome text not null,
  cor text not null,
  operacao text not null check (operacao in ('maquina-viral', 'agencia-lucas'))
);

create table if not exists agents (
  id text primary key,
  team_id text not null references teams(id),
  nome text not null,
  papel text not null default '',
  is_lead boolean not null default false,
  status text not null default 'idle' check (status in ('working', 'idle')),
  doing_now text not null default 'aguardando tarefa'
);

create table if not exists tasks (
  id text primary key default gen_random_uuid()::text,
  team_id text not null references teams(id),
  agent_id text references agents(id),
  operacao text not null,
  titulo text not null,
  etapa text not null default '',
  status text not null default 'running' check (status in ('running', 'waiting', 'done', 'error')),
  progress int not null default 0 check (progress between 0 and 100),
  drive_url text,
  post_time text,
  qa_score numeric,
  parent_id text,             -- sub-agent tasks point at the lead's task
  payload jsonb,              -- e.g. {"scenes": [...]} for Funny Pets review
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists events (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  team_id text references teams(id),
  agent_id text references agents(id),
  type text not null check (type in ('handoff', 'brain_read', 'brain_write', 'tool_run', 'toast')),
  payload jsonb not null default '{}'
);

create table if not exists approvals (
  id bigint generated always as identity primary key,
  task_id text not null references tasks(id),
  decision text not null check (decision in ('approved', 'changes')),
  feedback text default '',
  ts timestamptz not null default now()
);

create table if not exists schedule (
  id text primary key default gen_random_uuid()::text,
  data date not null,
  pagina text not null check (pagina in ('Worldframe', 'Funny Pets')),
  horario text not null,
  titulo text not null default '',
  task_id text references tasks(id),
  status text not null default 'aguardando' check (status in ('pronto', 'aguardando', 'postado'))
);

create table if not exists skills_runtime (
  team_id text not null references teams(id),
  skill text not null,
  progress int not null default 0,
  state text not null default 'idle' check (state in ('running', 'idle')),
  primary key (team_id, skill)
);

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists tasks_touch on tasks;
create trigger tasks_touch before update on tasks for each row execute function touch_updated_at();

-- Realtime
do $$ declare t text; begin
  foreach t in array array['agents','tasks','events','approvals','schedule','skills_runtime'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- RLS: the office (anon key) reads everything and may only insert approvals.
-- Agents use the service key, which bypasses RLS.
alter table teams enable row level security;
alter table agents enable row level security;
alter table tasks enable row level security;
alter table events enable row level security;
alter table approvals enable row level security;
alter table schedule enable row level security;
alter table skills_runtime enable row level security;
drop policy if exists "read" on teams;
create policy "read" on teams for select using (true);
drop policy if exists "read" on agents;
create policy "read" on agents for select using (true);
drop policy if exists "read" on tasks;
create policy "read" on tasks for select using (true);
drop policy if exists "read" on events;
create policy "read" on events for select using (true);
drop policy if exists "read" on approvals;
create policy "read" on approvals for select using (true);
drop policy if exists "read" on schedule;
create policy "read" on schedule for select using (true);
drop policy if exists "read" on skills_runtime;
create policy "read" on skills_runtime for select using (true);
drop policy if exists "approve" on approvals;
create policy "approve" on approvals for insert with check (true);


-- Seed
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
