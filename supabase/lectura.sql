-- Lectura: portada, páginas y progreso
alter table reading_items add column if not exists cover_url text;
alter table reading_items add column if not exists total_pages integer;
alter table reading_items add column if not exists current_page integer default 0;

-- URL puede estar vacía para libros físicos
alter table reading_items alter column url set default '';
