CREATE OR REPLACE FUNCTION public.patch_province_by_spatial_match(
  target_geometry jsonb
)
RETURNS text 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  matched_id bigint;
  matched_name text;
  postgis_geom geometry;
BEGIN
  -- 1. Safely convert incoming GeoJSON coordinate format directly into PostGIS geometry
  postgis_geom := ST_SetSRID(ST_GeomFromGeoJSON(target_geometry), 4326);
  
  -- 2. Force MultiPolygon casting if PostGIS infers it as a Polygon wrapper
  IF ST_GeometryType(postgis_geom) = 'ST_Polygon' THEN
    postgis_geom := ST_Multi(postgis_geom);
  END IF;

  -- 3. Intersect the centroid or coordinate plane with your active provinces table entries
  SELECT id, name 
  INTO matched_id, matched_name
  FROM public.provinces
  WHERE ST_Intersects(geo_json, ST_Centroid(postgis_geom))
  LIMIT 1;

  -- 4. Execute the field patch overwrite if a spatial match is confirmed
  IF matched_id IS NOT NULL THEN
    UPDATE public.provinces
    SET geo_json = postgis_geom
    WHERE id = matched_id;
    
    RETURN 'SUCCESS: Patched province ' || matched_name;
  ELSE
    RETURN 'WARNING: No intersecting province map layer matches this feature.';
  END IF;
END;
$$;