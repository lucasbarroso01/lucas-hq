-- Lucas HQ · botão "Abrir Drive": links da pasta raiz e da pasta do dia (gravados pelo drive_upload.py)
alter table controle add column if not exists drive_raiz text;
alter table controle add column if not exists drive_dia text;
alter table controle add column if not exists drive_dia_data date;
