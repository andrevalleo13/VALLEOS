-- Adds title and obsidian_path to brain_notes for Obsidian vault sync
alter table brain_notes
  add column if not exists title text,
  add column if not exists obsidian_path text;

create unique index if not exists brain_notes_obsidian_path_idx
  on brain_notes (obsidian_path)
  where obsidian_path is not null;
