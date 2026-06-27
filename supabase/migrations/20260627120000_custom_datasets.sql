-- Custom map overlay datasets (built-in choropleth layers keyed by PSGC).

create table custom_datasets (
    id text primary key,
    title text not null,
    description text,
    category text not null,
    kind text not null check (kind in ('numeric', 'categorical')),
    level text not null,
    unit text,
    value_label text,
    source_name text,
    source_url text
);

create table custom_dataset_values (
    dataset_id text not null references custom_datasets (id) on delete cascade,
    psgc text not null,
    value numeric,
    category text,
    detail jsonb,
    primary key (dataset_id, psgc)
);

create index custom_dataset_values_dataset_id_idx on custom_dataset_values (dataset_id);
create index custom_dataset_values_psgc_idx on custom_dataset_values (psgc);

alter table custom_datasets enable row level security;
alter table custom_dataset_values enable row level security;

create policy "public read custom_datasets" on custom_datasets for select using (true);
create policy "public read custom_dataset_values" on custom_dataset_values for select using (true);
