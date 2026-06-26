-- Barangays reference table (metadata; geometry in Storage under municities/bgy/).

create table barangays (
    psgc text primary key,
    correspondence text,
    name text not null,
    geo_lvl text not null,
    city_lvl text,
    municity_psgc text references municities (psgc),
    province_psgc text references provinces (psgc),
    region_psgc text references regions (psgc)
);

alter table barangays enable row level security;

create policy "public read barangays" on barangays for select using (true);
