-- Publicação (social-mcp): bucket PRIVADO só para o vídeo que o Instagram precisa baixar.
-- Sem políticas para anon: só a service key (no .env da social-mcp, no Chromebook) envia, assina e apaga.
-- O vídeo sobe na hora da publicação, a Meta recebe um link assinado de 1 hora e o objeto é apagado logo depois.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social-staging', 'social-staging', false, 52428800, array['video/mp4', 'video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
