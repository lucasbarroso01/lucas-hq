-- Upload de referências do Acervo pela interface (Supabase Storage).
-- Bucket privado, só vídeo, até 100 MB por arquivo. A interface (chave anon) só pode ENVIAR e LISTAR
-- dentro de referencias/; não pode apagar nem substituir. O Chromebook baixa com a service key.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('acervo', 'acervo', false, 104857600, array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "acervo: enviar referencias" on storage.objects;
create policy "acervo: enviar referencias" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'acervo' and (storage.foldername(name))[1] = 'referencias');

drop policy if exists "acervo: listar" on storage.objects;
create policy "acervo: listar" on storage.objects for select to anon, authenticated
  using (bucket_id = 'acervo');
