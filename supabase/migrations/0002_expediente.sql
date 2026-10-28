-- Lucas HQ · expediente: status novos de tarefas e da agenda
alter table tasks drop constraint if exists tasks_status_check;
alter table tasks add constraint tasks_status_check
  check (status in ('na_fila', 'running', 'waiting', 'waiting_upstream', 'done', 'error', 'atrasado'));

alter table schedule add column if not exists drive_url text;
alter table schedule drop constraint if exists schedule_status_check;
update schedule set status = 'planejado' where status = 'aguardando';
alter table schedule alter column status set default 'planejado';
alter table schedule add constraint schedule_status_check
  check (status in ('planejado', 'pronto', 'aprovado', 'postado', 'atrasado'));

-- A interface (chave anon) pode só mudar o status do post ("marcar como postado").
revoke update on schedule from anon;
grant update (status) on schedule to anon;
drop policy if exists "marcar postado" on schedule;
create policy "marcar postado" on schedule for update using (true) with check (status in ('aprovado', 'postado'));
