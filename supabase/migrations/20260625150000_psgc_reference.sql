-- PSGC-keyed reference tables for regions, provinces, and municities (metadata only; geometry in Storage).

create table regions (
    psgc text primary key,
    correspondence text,
    name text not null,
    geo_lvl text not null,
    city_lvl text
);

create table provinces (
    psgc text primary key,
    correspondence text,
    name text not null,
    geo_lvl text not null,
    city_lvl text,
    region_psgc text not null references regions (psgc)
);

create table municities (
    psgc text primary key,
    correspondence text,
    name text not null,
    geo_lvl text not null,
    city_lvl text,
    province_psgc text references provinces (psgc),
    region_psgc text references regions (psgc)
);

alter table regions enable row level security;
alter table provinces enable row level security;
alter table municities enable row level security;

create policy "public read regions" on regions for select using (true);
create policy "public read provinces" on provinces for select using (true);
create policy "public read municities" on municities for select using (true);

insert into storage.buckets (id, name, public)
values ('geo', 'geo', true)
on conflict (id) do update set public = true;
