-- Public, privacy-safe platform counters for landing-page social proof.
-- The public function returns rounded display numbers only, never exact counts.

create or replace function public.get_public_platform_stats()
returns table (
  rounded_wedding_plans_started integer,
  wedding_plans_started_display text
)
language sql
stable
security definer
set search_path = public
as $$
  with counts as (
    select count(*)::integer as total
    from public.weddings
    where status <> 'cancelled'
  ),
  rounded as (
    select
      case
        when total < 10 then total
        when total < 100 then floor(total / 10.0)::integer * 10
        when total < 1000 then floor(total / 25.0)::integer * 25
        else floor(total / 100.0)::integer * 100
      end as visible_total
    from counts
  )
  select
    visible_total as rounded_wedding_plans_started,
    visible_total::text || '+' as wedding_plans_started_display
  from rounded;
$$;

revoke all on function public.get_public_platform_stats() from public;
grant execute on function public.get_public_platform_stats() to anon, authenticated;
