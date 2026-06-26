-- PSA GDP by province/HUC (current prices, stored as actual pesos).

alter table division_stats add column if not exists gdp_2022 bigint;
alter table division_stats add column if not exists gdp_2023 bigint;
alter table division_stats add column if not exists gdp_2024 bigint;
