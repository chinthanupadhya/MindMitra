-- MindMitra: convert rounds.difficulty_value from real to jsonb
-- Run this in the Supabase SQL editor. Existing scalar values become JSON numbers.
ALTER TABLE rounds
  ALTER COLUMN difficulty_value TYPE jsonb
  USING to_jsonb(difficulty_value);
