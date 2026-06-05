SELECT pg_catalog.set_config('search_path', 'public, extensions, adm, auth', false);

DROP VIEW  IF EXISTS public.municities_enriched  CASCADE;
DROP VIEW  IF EXISTS public.regions_geojson      CASCADE;
DROP VIEW  IF EXISTS public.provinces_geojson    CASCADE;
DROP VIEW  IF EXISTS public.municities_geojson   CASCADE;
DROP TABLE IF EXISTS public.user_place_goals     CASCADE;
DROP TABLE IF EXISTS public.journal_photos       CASCADE;
DROP TABLE IF EXISTS public.journal_entries      CASCADE;
DROP TABLE IF EXISTS public.visited_places       CASCADE;
DROP TABLE IF EXISTS public.users                CASCADE;
DROP TABLE IF EXISTS public.place_tags           CASCADE;
DROP TABLE IF EXISTS public.tags                 CASCADE;
DROP TABLE IF EXISTS public.places               CASCADE;
DROP TABLE IF EXISTS public.municities           CASCADE;
DROP TABLE IF EXISTS public.provinces            CASCADE;
DROP TABLE IF EXISTS public.regions              CASCADE;

DROP FUNCTION IF EXISTS public.set_visited_at()            CASCADE;
DROP FUNCTION IF EXISTS public.sync_goal_to_heatmap()      CASCADE;
DROP FUNCTION IF EXISTS public.truncate_reference_tables()  CASCADE;

CREATE EXTENSION IF NOT EXISTS postgis     SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

CREATE TABLE public.regions (
  id       integer      NOT NULL,
  code     varchar(10)  NOT NULL UNIQUE,
  name     varchar(100) NOT NULL,
  geometry geometry(Geometry, 4326),
  geojson  jsonb,
  CONSTRAINT regions_pk PRIMARY KEY (id)
);

CREATE TABLE public.provinces (
  id        integer      NOT NULL,
  code      varchar(10)  NOT NULL UNIQUE,
  name      varchar(100) NOT NULL,
  region_id integer      NOT NULL,
  geometry  geometry(Geometry, 4326),
  geojson   jsonb,
  CONSTRAINT provinces_pk           PRIMARY KEY (id),
  CONSTRAINT provinces_region_id_fk FOREIGN KEY (region_id)
    REFERENCES public.regions(id)
);

CREATE TABLE public.municities (
  id          integer      NOT NULL,
  name        varchar(100) NOT NULL,
  code        varchar(10)  NOT NULL UNIQUE,
  geometry    geometry(Geometry, 4326),
  geojson     jsonb,
  province_id integer,
  region_id   integer,
  type        varchar(20)  NOT NULL
    CHECK (type IN ('city', 'municipality')),
  CONSTRAINT municities_pk             PRIMARY KEY (id),
  CONSTRAINT municities_province_id_fk FOREIGN KEY (province_id)
    REFERENCES public.provinces(id),
  CONSTRAINT municities_region_id_fk   FOREIGN KEY (region_id)
    REFERENCES public.regions(id),
  CONSTRAINT municities_needs_location CHECK (
    province_id IS NOT NULL OR region_id IS NOT NULL
  )
);

CREATE TABLE public.places (
  id          uuid             NOT NULL DEFAULT gen_random_uuid(),
  municity_id integer          NOT NULL,
  osm_id      varchar(50)      UNIQUE,
  name        varchar(200)     NOT NULL,
  category    varchar(100),
  lat         double precision,
  lng         double precision,
  description text,
  CONSTRAINT places_pk             PRIMARY KEY (id),
  CONSTRAINT places_municity_id_fk FOREIGN KEY (municity_id)
    REFERENCES public.municities(id)
);

CREATE TABLE public.tags (
  id   integer     NOT NULL GENERATED ALWAYS AS IDENTITY,
  name varchar(50) NOT NULL UNIQUE,
  CONSTRAINT tags_pk PRIMARY KEY (id)
);

CREATE TABLE public.place_tags (
  place_id uuid    NOT NULL,
  tag_id   integer NOT NULL,
  CONSTRAINT place_tags_pk          PRIMARY KEY (place_id, tag_id),
  CONSTRAINT place_tags_place_id_fk FOREIGN KEY (place_id)
    REFERENCES public.places(id) ON DELETE CASCADE,
  CONSTRAINT place_tags_tag_id_fk   FOREIGN KEY (tag_id)
    REFERENCES public.tags(id)   ON DELETE CASCADE
);

CREATE TABLE public.users (
  id         uuid NOT NULL,
  username   varchar(50),
  avatar_url text,
  map_color  text NOT NULL DEFAULT '#ec4899',
  CONSTRAINT users_pk    PRIMARY KEY (id),
  CONSTRAINT users_id_fk FOREIGN KEY (id)
    REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.visited_places (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  place_id   uuid NOT NULL,
  visited_at date NOT NULL DEFAULT current_date,
  CONSTRAINT visited_places_pk          PRIMARY KEY (id),
  CONSTRAINT visited_places_user_id_fk  FOREIGN KEY (user_id)
    REFERENCES public.users(id)  ON DELETE CASCADE,
  CONSTRAINT visited_places_place_id_fk FOREIGN KEY (place_id)
    REFERENCES public.places(id) ON DELETE CASCADE,
  CONSTRAINT visited_places_unique UNIQUE (user_id, place_id)
);

CREATE TABLE public.journal_entries (
  id         uuid         NOT NULL DEFAULT gen_random_uuid(),
  user_id    uuid         NOT NULL,
  place_id   uuid         NOT NULL,
  title      varchar(200),
  content    text,
  visit_date date,
  created_at timestamp    NOT NULL DEFAULT now(),
  updated_at timestamp    NOT NULL DEFAULT now(),
  CONSTRAINT journal_entries_pk          PRIMARY KEY (id),
  CONSTRAINT journal_entries_user_id_fk  FOREIGN KEY (user_id)
    REFERENCES public.users(id)  ON DELETE CASCADE,
  CONSTRAINT journal_entries_place_id_fk FOREIGN KEY (place_id)
    REFERENCES public.places(id) ON DELETE CASCADE
);

CREATE TABLE public.journal_photos (
  id            uuid    NOT NULL DEFAULT gen_random_uuid(),
  journal_id    uuid    NOT NULL,
  storage_url   text    NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  CONSTRAINT journal_photos_pk            PRIMARY KEY (id),
  CONSTRAINT journal_photos_journal_id_fk FOREIGN KEY (journal_id)
    REFERENCES public.journal_entries(id) ON DELETE CASCADE
);

CREATE TABLE public.user_place_goals (
  id         uuid      NOT NULL DEFAULT gen_random_uuid(),
  user_id    uuid      NOT NULL,
  place_id   uuid      NOT NULL,
  added_at   timestamp NOT NULL DEFAULT now(),
  is_visited boolean   NOT NULL DEFAULT false,
  visited_at timestamp,
  CONSTRAINT user_place_goals_pk          PRIMARY KEY (id),
  CONSTRAINT user_place_goals_user_id_fk  FOREIGN KEY (user_id)
    REFERENCES public.users(id)  ON DELETE CASCADE,
  CONSTRAINT user_place_goals_place_id_fk FOREIGN KEY (place_id)
    REFERENCES public.places(id) ON DELETE CASCADE,
  CONSTRAINT user_place_goals_unique UNIQUE (user_id, place_id),
  CONSTRAINT user_place_goals_visited_check CHECK (
    (is_visited = false AND visited_at IS NULL) OR
    (is_visited = true  AND visited_at IS NOT NULL)
  )
);

CREATE OR REPLACE FUNCTION public.set_visited_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  IF NEW.is_visited = true
    AND OLD.is_visited = false
    AND NEW.visited_at IS NULL
  THEN
    NEW.visited_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_goal_to_heatmap()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  IF NEW.is_visited = true
    AND (TG_OP = 'INSERT' OR OLD.is_visited = false)
  THEN
    INSERT INTO public.visited_places (user_id, place_id, visited_at)
    VALUES (
      NEW.user_id,
      NEW.place_id,
      COALESCE(NEW.visited_at::date, current_date)
    )
    ON CONFLICT (user_id, place_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.truncate_reference_tables()
RETURNS void LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public AS $$
BEGIN
  TRUNCATE public.municities, public.provinces, public.regions CASCADE;
END;
$$;

REVOKE ALL ON FUNCTION public.truncate_reference_tables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.truncate_reference_tables() TO service_role;

CREATE TRIGGER trg_set_visited_at
  BEFORE UPDATE ON public.user_place_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_visited_at();

CREATE TRIGGER trg_journal_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime(updated_at);

CREATE TRIGGER trg_sync_goal_to_heatmap
  AFTER INSERT OR UPDATE ON public.user_place_goals
  FOR EACH ROW EXECUTE FUNCTION public.sync_goal_to_heatmap();

CREATE OR REPLACE VIEW public.municities_enriched
WITH (security_invoker = true) AS
SELECT
  m.*,
  COALESCE(m.region_id, p.region_id) AS effective_region_id
FROM public.municities m
LEFT JOIN public.provinces p ON p.id = m.province_id;

GRANT SELECT ON public.municities_enriched TO anon, authenticated;

CREATE INDEX idx_provinces_region    ON public.provinces(region_id);
CREATE INDEX idx_municities_province ON public.municities(province_id);
CREATE INDEX idx_municities_region   ON public.municities(region_id);
CREATE INDEX idx_places_municity     ON public.places(municity_id);

CREATE INDEX idx_regions_geometry    ON public.regions    USING GIST(geometry);
CREATE INDEX idx_provinces_geometry  ON public.provinces  USING GIST(geometry);
CREATE INDEX idx_municities_geometry ON public.municities USING GIST(geometry);

CREATE INDEX idx_regions_geojson     ON public.regions    USING GIN(geojson);
CREATE INDEX idx_provinces_geojson   ON public.provinces  USING GIN(geojson);
CREATE INDEX idx_municities_geojson  ON public.municities USING GIN(geojson);

CREATE INDEX idx_visited_user        ON public.visited_places(user_id);
CREATE INDEX idx_visited_place       ON public.visited_places(place_id);
CREATE INDEX idx_journal_user        ON public.journal_entries(user_id);
CREATE INDEX idx_journal_place       ON public.journal_entries(place_id);
CREATE INDEX idx_goals_user          ON public.user_place_goals(user_id);
CREATE INDEX idx_goals_place         ON public.user_place_goals(place_id);
CREATE INDEX idx_photos_journal      ON public.journal_photos(journal_id);

ALTER TABLE public.regions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provinces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_tags       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visited_places   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_photos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_place_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regions_public_read"    ON public.regions    FOR SELECT USING (true);
CREATE POLICY "provinces_public_read"  ON public.provinces  FOR SELECT USING (true);
CREATE POLICY "municities_public_read" ON public.municities FOR SELECT USING (true);
CREATE POLICY "tags_public_read"       ON public.tags       FOR SELECT USING (true);
CREATE POLICY "place_tags_public_read" ON public.place_tags FOR SELECT USING (true);

CREATE POLICY "places_public_read" ON public.places FOR SELECT USING (true);
CREATE POLICY "places_authenticated_insert" ON public.places FOR INSERT
  WITH CHECK ((SELECT auth.role()) = 'authenticated');

CREATE POLICY "users_select_own" ON public.users FOR SELECT USING ((SELECT auth.uid()) = id);
CREATE POLICY "users_insert_own" ON public.users FOR INSERT WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING ((SELECT auth.uid()) = id);

CREATE POLICY "visited_select_own" ON public.visited_places FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "visited_insert_own" ON public.visited_places FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "visited_update_own" ON public.visited_places FOR UPDATE USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "visited_delete_own" ON public.visited_places FOR DELETE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "journal_select_own" ON public.journal_entries FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "journal_insert_own" ON public.journal_entries FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "journal_update_own" ON public.journal_entries FOR UPDATE USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "journal_delete_own" ON public.journal_entries FOR DELETE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "photos_select_own" ON public.journal_photos FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_id AND je.user_id = (SELECT auth.uid())));
CREATE POLICY "photos_insert_own" ON public.journal_photos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_id AND je.user_id = (SELECT auth.uid())));
CREATE POLICY "photos_delete_own" ON public.journal_photos FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_id AND je.user_id = (SELECT auth.uid())));

CREATE POLICY "goals_select_own" ON public.user_place_goals FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "goals_insert_own" ON public.user_place_goals FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "goals_update_own" ON public.user_place_goals FOR UPDATE USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "goals_delete_own" ON public.user_place_goals FOR DELETE USING ((SELECT auth.uid()) = user_id);

COMMENT ON TABLE  public.provinces           IS '83 provinces including Metro Manila (id 1) and split Maguindanao (75/76). region_id NOT NULL.';
COMMENT ON TABLE  public.municities          IS 'Cities/municipalities. code NOT NULL UNIQUE. province_id OR region_id required; region_id may be denormalized for HUC/ICC.';
COMMENT ON COLUMN public.municities.region_id IS 'Nullable for province-linked rows; set directly for HUC/ICC. When both are set, region_id is denormalized from province for queries.';
COMMENT ON COLUMN public.regions.geometry    IS 'PostGIS WKB binary. Used for spatial queries.';
COMMENT ON COLUMN public.regions.geojson     IS 'Pre-rendered GeoJSON for frontend map rendering.';
COMMENT ON COLUMN public.provinces.geometry  IS 'PostGIS WKB binary. Used for spatial queries.';
COMMENT ON COLUMN public.provinces.geojson   IS 'Pre-rendered GeoJSON for frontend map rendering.';
COMMENT ON COLUMN public.municities.geometry IS 'PostGIS WKB binary. Used for spatial queries.';
COMMENT ON COLUMN public.municities.geojson  IS 'Pre-rendered GeoJSON for frontend map rendering.';