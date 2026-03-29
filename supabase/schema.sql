-- Run in Supabase SQL editor (or migrate) before using the upload pipeline.
-- Requires pgvector: Database → Extensions → enable "vector".

create extension if not exists "uuid-ossp";
create extension if not exists vector;

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  contract_type text,
  summary text,
  health_score numeric,
  money_at_risk numeric,
  leverage_total numeric,
  total_chunks integer,
  status text default 'active',
  analyzed_at timestamptz,
  next_critical_date timestamptz,
  counterparty_name text,
  created_at timestamptz default now()
);

create table if not exists public.contract_chunks (
  id bigserial primary key,
  contract_id uuid not null references public.contracts (id) on delete cascade,
  chunk_text text,
  chunk_index integer not null,
  section_number text,
  section_title text,
  page_number integer,
  embedding vector (1536),
  clause_type text default 'general',
  category text default 'neutral',
  severity text default 'none',
  dollar_impact numeric,
  impact_explanation text,
  trigger_date text,
  action_deadline text,
  is_recurring boolean default false,
  title text,
  analysis text,
  recommended_action text,
  created_at timestamptz default now()
);

create index if not exists contract_chunks_contract_id_idx
  on public.contract_chunks (contract_id);

create index if not exists contracts_analyzed_at_idx
  on public.contracts (analyzed_at desc);
