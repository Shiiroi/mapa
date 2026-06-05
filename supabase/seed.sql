BEGIN;

TRUNCATE
  public.user_place_goals,
  public.journal_photos,
  public.journal_entries,
  public.visited_places,
  public.place_tags,
  public.places,
  public.users
RESTART IDENTITY CASCADE;

TRUNCATE
  public.municities,
  public.provinces,
  public.regions,
  public.tags
RESTART IDENTITY CASCADE;

COMMIT;