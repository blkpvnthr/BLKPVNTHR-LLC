-- Application-layer rate limiting (fixed-window), used by auth endpoints as a
-- defense-in-depth fallback for the Vercel WAF. Counters are per bucket+window;
-- the table is accessed ONLY through the SECURITY DEFINER rl_hit() function.
create table administration.rate_limits (
  bucket       text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (bucket, window_start)
);
alter table administration.rate_limits enable row level security;
alter table administration.rate_limits force row level security;
-- No policies and no grants: unreachable except via rl_hit() (definer).

-- Atomically increment the current window's counter; returns true if the request
-- is within the limit, false if it exceeds it.
create or replace function public.rl_hit(p_bucket text, p_limit integer, p_window_secs integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_window_secs) * p_window_secs);
  v_hits integer;
begin
  insert into administration.rate_limits (bucket, window_start, hits)
    values (p_bucket, v_window, 1)
    on conflict (bucket, window_start)
      do update set hits = administration.rate_limits.hits + 1
    returning hits into v_hits;
  -- Opportunistic cleanup of old windows (cheap, bounded).
  delete from administration.rate_limits where window_start < clock_timestamp() - interval '1 day';
  return v_hits <= p_limit;
end;
$$;

revoke all on function public.rl_hit(text, integer, integer) from public;
grant execute on function public.rl_hit(text, integer, integer) to anon, authenticated;
