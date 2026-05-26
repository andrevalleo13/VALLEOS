-- Brain: auto-tagging semántico (aditivo, sin borrar datos)
-- Shadow extrae etiquetas y enlaza notas relacionadas al capturar.

alter table brain_notes add column if not exists title text;
alter table brain_notes add column if not exists obsidian_path text;
alter table brain_notes add column if not exists tags text[] default '{}';
alter table brain_notes add column if not exists related_ids uuid[] default '{}';

create index if not exists idx_brain_notes_tags on brain_notes using gin (tags);
