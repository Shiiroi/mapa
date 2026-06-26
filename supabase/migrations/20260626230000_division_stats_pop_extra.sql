-- 2010 census population and 2020 CPH household age/sex distribution.

alter table division_stats add column if not exists pop_2010 integer;
alter table division_stats add column if not exists pop_male_2020 integer;
alter table division_stats add column if not exists pop_female_2020 integer;
alter table division_stats add column if not exists age_sex_2020 jsonb;
