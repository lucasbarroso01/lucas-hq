-- Lucas HQ · botão "Pausar operação"
create table if not exists controle (
  id text primary key,
  pausado boolean not null default false,
  motivo text not null default '',
  atualizado_em timestamptz not null default now()
);
insert into controle (id) values ('operacao') on conflict do nothing;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'controle') then
    alter publication supabase_realtime add table controle;
  end if;
end $$;

alter table controle enable row level security;
drop policy if exists "read" on controle;
create policy "read" on controle for select using (true);
-- a interface (chave anon) só liga/desliga a pausa e escreve o motivo
revoke update on controle from anon;
grant update (pausado, motivo, atualizado_em) on controle to anon;
drop policy if exists "pausar" on controle;
create policy "pausar" on controle for update using (id = 'operacao') with check (id = 'operacao');
