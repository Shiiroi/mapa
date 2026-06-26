-- Population, area, and density stats keyed by PSGC (metadata only; geometry in Storage).

create table division_stats (
    psgc text primary key,
    level text not null,
    pop_2015 integer,
    pop_2020 integer,
    pop_2024 integer,
    area_km2 numeric,
    density_2024 numeric,
    pct_change_2020_2024 numeric
);

create index division_stats_level_idx on division_stats (level);

alter table division_stats enable row level security;

create policy "public read division_stats" on division_stats for select using (true);
