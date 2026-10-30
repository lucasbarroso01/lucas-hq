-- 30/10: Funny Pets sai do escritório; entra o Acervo de Virais (banco de referências).
insert into teams (id, nome, cor, operacao) values ('acervo', 'Acervo de Virais', '#E5893B', 'maquina-viral')
  on conflict (id) do update set nome = excluded.nome, cor = excluded.cor;
insert into agents (id, team_id, nome, papel, is_lead)
  values ('curador-acervo', 'acervo', 'curador-acervo', 'Ficha os virais que o Lucas manda (copy, tema, edição)', true)
  on conflict (id) do update set team_id = excluded.team_id, papel = excluded.papel;
insert into skills_runtime (team_id, skill) values ('acervo', 'hypit-video'), ('acervo', 'ig-viral')
  on conflict do nothing;
-- histórico (tarefas e eventos antigos) fica; só some da interface
delete from skills_runtime where team_id = 'producao-pets';
delete from schedule where pagina = 'Funny Pets' and status in ('planejado', 'pronto');
