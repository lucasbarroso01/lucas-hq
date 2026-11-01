-- Pautas: temas que o Lucas pede pela aba "Pautas". O Radar pega daqui primeiro (só pesquisa os fatos e as fontes).
create table if not exists pautas (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  tema text not null,
  gancho text not null default '',
  categoria text not null default 'geopolitica',
  ordem int not null default 1000,
  status text not null default 'fila' check (status in ('fila', 'em_uso', 'feito', 'descartado')),
  usado_em date,
  video_slug text,
  nota text not null default ''
);
alter table pautas enable row level security;
drop policy if exists "read" on pautas;
create policy "read" on pautas for select using (true);
drop policy if exists "lucas escreve" on pautas;
create policy "lucas escreve" on pautas for insert to anon, authenticated with check (status = 'fila');
drop policy if exists "lucas edita" on pautas;
create policy "lucas edita" on pautas for update to anon, authenticated using (true) with check (true);
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'pautas') then
    alter publication supabase_realtime add table pautas;
  end if;
end $$;

-- 50 pautas iniciais do Lucas (31/10); só entram se a tabela estiver vazia
insert into pautas (categoria, tema, gancho, ordem)
select * from (values
  ('guerras', 'Operation Absolute Resolve: a captura de Maduro em Caracas (3/jan)', 'In one night, US forces flew into Caracas and took a sitting president.', 1),
  ('guerras', 'Operation Epic Fury: as primeiras 24h da guerra com o Irã (28/fev)', 'The first strike of this war killed the most protected man in Iran.', 2),
  ('geopolitica', 'Como Khamenei foi morto e como o filho, Mojtaba, assumiu', 'Iran''s supreme leader was gone. His son took power 8 days later.', 3),
  ('economia', 'Estreito de Hormuz fechado: o maior choque de petróleo da história', '21% of the world''s oil passes through a strip of water 33 km wide. In 2026, it closed.', 4),
  ('guerras', 'O ataque à Ilha de Kharg, coração do petróleo iraniano', 'One island holds 90% of Iran''s oil exports. The US hit it.', 5),
  ('geopolitica', 'O bloqueio naval americano ao Irã e o Memorando de Islamabad', 'No ship in, no ship out. How the US tried to starve a country of oil.', 6),
  ('economia', 'A guerra do Irã em números: US$ 47 bi e 8 meses', 'This war has cost the US $47 billion. Here''s where every dollar went.', 7),
  ('geopolitica', 'A crise da Groenlândia: por que os EUA querem a maior ilha do mundo', 'The US tried to buy it. Then things got serious.', 8),
  ('guerras', 'A guerra Afeganistão × Paquistão', 'Two nuclear neighbors'' worst nightmare just started next door.', 9),
  ('geopolitica', 'O fim do New START: o último tratado nuclear EUA-Rússia expirou', 'For the first time in 50 years, nothing limits the world''s nuclear arsenals.', 10),
  ('guerras', 'Operation Neptune Spear: os 38 minutos que mataram Bin Laden', 'Two helicopters. 23 SEALs. 38 minutes. One crash nobody planned.', 11),
  ('guerras', 'Operation Red Dawn: Saddam achado num buraco de 2 metros', 'The most wanted man in Iraq was hiding under a rug.', 12),
  ('guerras', 'Operation Just Cause: os EUA invadem o Panamá para pegar Noriega', '35 years before Maduro, the US did this to another dictator.', 13),
  ('guerras', 'Operation Midnight Hammer (2025): B-2s contra o bunker de Fordow', '37 hours of flight to drop a 13-ton bomb on a mountain.', 14),
  ('guerras', 'Entebbe: 4.000 km para resgatar 102 reféns em 90 minutos', 'Israel flew 4,000 km to free hostages in 90 minutes.', 15),
  ('guerras', 'Operation Eagle Claw: o resgate no Irã que deu tudo errado', 'This rescue mission failed before it reached the hostages.', 16),
  ('guerras', 'Black Hawk Down: a batalha de Mogadíscio', 'A 1-hour mission turned into an 18-hour nightmare.', 17),
  ('guerras', 'Operation Opera: Israel destrói o reator nuclear do Iraque em 1981', '8 jets, 2 minutes over target, one reactor gone.', 18),
  ('guerras', 'Operation Spiderweb (2025): drones da Ucrânia escondidos em caminhões', 'Ukraine hid drones inside trucks and hit Russia''s bombers 4,000 km away.', 19),
  ('guerras', 'Operation Mincemeat: o cadáver que enganou Hitler', 'A dead man with fake papers changed World War II.', 20),
  ('guerras', 'Operation Fortitude: o exército fantasma de tanques infláveis no Dia D', 'The biggest army in Britain was made of rubber.', 21),
  ('guerras', 'Doolittle Raid: 16 bombardeiros, só ida, para Tóquio', 'They knew they didn''t have enough fuel to come back.', 22),
  ('curiosidades', 'Operation Paperclip: os cientistas nazistas que levaram o homem à Lua', 'The man who built Hitler''s rockets later built NASA''s.', 23),
  ('guerras', 'Desert Storm: a guerra de 100 horas', 'The fourth-largest army in the world collapsed in 100 hours.', 24),
  ('geopolitica', '13 dias da crise dos mísseis de Cuba, hora a hora', 'The world was one submarine captain away from nuclear war.', 25),
  ('economia', 'E se a Nasdaq ficasse desligada por 72 horas?', '$30 trillion in stocks frozen. Nobody can sell.', 26),
  ('economia', 'E se Hormuz fechasse para sempre?', 'Gas at $10 a gallon is the optimistic scenario.', 27),
  ('economia', 'E se um país fosse cortado do SWIFT amanhã?', 'One button can disconnect a country from the world''s money.', 28),
  ('economia', 'E se os EUA dessem calote na dívida?', 'The world''s ''safest'' asset defaults. Day 1 looks like this.', 29),
  ('economia', 'E se a bolha da IA estourasse?', 'Seven companies hold a huge share of the S&P 500. What if they fall?', 30),
  ('economia', 'E se todo o ouro do mundo fosse vendido de uma vez?', 'All the gold ever mined fits in 3.5 Olympic pools.', 31),
  ('economia', 'E se o Bitcoin fosse banido nos EUA?', 'Millions of wallets, one law.', 32),
  ('economia', 'A semana em que a guerra mexeu no seu bolso (petróleo, combustível, juros, mercados em 2026)', 'This war started 12,000 km away. It hit your wallet in a week.', 33),
  ('economia', 'E se a China vendesse todos os títulos americanos?', 'China holds hundreds of billions in US debt. What if it dumped it all?', 34),
  ('economia', 'E se o dólar perdesse o posto de moeda mundial?', 'Every barrel of oil is priced in dollars. For now.', 35),
  ('politica', 'Raúl Castro acusado de assassinato pelos EUA e o que isso significa para Cuba', 'After Maduro, Washington pointed at Havana.', 36),
  ('geopolitica', 'Por que a Groenlândia vale trilhões (terras raras, Ártico, rotas)', 'Under the ice: minerals worth more than most countries.', 37),
  ('geopolitica', 'Quem manda no Irã agora? O novo poder depois de Khamenei', 'A son, a guard and a council. Who really runs Iran now?', 38),
  ('geopolitica', 'Venezuela depois de Maduro: o que aconteceu com o país', 'The dictator is gone. Then what?', 39),
  ('economia', 'O país que mais gasta com guerra × o que mais ganha com ela', 'Someone always profits from a war. Here''s who.', 40),
  ('politica', 'Eleições 2026 nos EUA e no Brasil: o que está em jogo, em números (apresentação neutra)', 'Two elections, 400 million voters, one year.', 41),
  ('geopolitica', 'EUA 250 anos: como uma colônia virou a maior potência', 'In 1776 they had 13 colonies. Now 750 military bases abroad.', 42),
  ('curiosidades', 'Artemis II: os primeiros humanos perto da Lua em 50 anos', 'The last time humans went this far, your parents were kids.', 43),
  ('curiosidades', 'Copa do Mundo 2026 em números: a maior da história', '48 teams, 104 games, 3 countries.', 44),
  ('guerras', 'Quanto custa um dia de guerra moderna (míssil, porta-aviões, drone)', 'One interceptor missile costs more than your house.', 45),
  ('curiosidades', 'Porta-aviões: uma cidade flutuante de 5.000 pessoas', 'It has its own hospital, jail and post office.', 46),
  ('curiosidades', 'Os bunkers do Juízo Final: onde os líderes se escondem', 'If nuclear war started now, here''s where they''d go.', 47),
  ('guerras', 'Drones × tanques: como um drone de US$ 500 destrói um tanque de US$ 5 milhões', 'The cheapest weapon in the war is winning.', 48),
  ('curiosidades', '25 anos do 11 de Setembro: os 102 minutos em números', '102 minutes that changed every airport on Earth.', 49),
  ('curiosidades', 'E se um ataque cortasse os cabos submarinos da internet?', '95% of the internet runs through cables on the ocean floor.', 50)
) v(categoria, tema, gancho, ordem)
where not exists (select 1 from pautas);
