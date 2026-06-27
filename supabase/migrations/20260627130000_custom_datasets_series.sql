-- Extend custom_datasets for multi-series overlays.

alter table custom_datasets drop constraint if exists custom_datasets_kind_check;
alter table custom_datasets add constraint custom_datasets_kind_check
    check (kind in ('numeric', 'categorical', 'series'));

alter table custom_datasets add column if not exists series jsonb;
