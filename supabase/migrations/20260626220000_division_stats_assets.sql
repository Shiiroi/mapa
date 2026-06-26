-- COA CY2024 AFR total assets (stored as actual pesos: thousand-peso report value × 1000).

alter table division_stats add column if not exists assets_2024 bigint;
