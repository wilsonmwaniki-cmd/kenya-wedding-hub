create table if not exists public.contribution_summary_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  client_id uuid null references public.planner_clients(id) on delete cascade,
  share_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists contribution_summary_shares_share_token_idx
  on public.contribution_summary_shares (share_token);

create unique index if not exists contribution_summary_shares_user_null_client_idx
  on public.contribution_summary_shares (user_id)
  where client_id is null;

create unique index if not exists contribution_summary_shares_user_client_idx
  on public.contribution_summary_shares (user_id, client_id)
  where client_id is not null;

alter table public.contribution_summary_shares enable row level security;

drop policy if exists "Users can manage own contribution summary shares" on public.contribution_summary_shares;
create policy "Users can manage own contribution summary shares"
on public.contribution_summary_shares
for all
using (public.can_access_contribution_record(user_id, client_id))
with check (public.can_access_contribution_record(user_id, client_id));

drop trigger if exists update_contribution_summary_shares_updated_at on public.contribution_summary_shares;
create trigger update_contribution_summary_shares_updated_at
before update on public.contribution_summary_shares
for each row
execute function public.update_updated_at_column();

create or replace function public.ensure_contribution_share_token(_client_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _effective_user_id uuid;
  _share_token uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if _client_id is null then
    if not exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'couple'
    ) then
      raise exception 'Couple access required';
    end if;

    _effective_user_id := auth.uid();
  else
    select pc.planner_user_id
      into _effective_user_id
    from public.planner_clients pc
    where pc.id = _client_id
      and public.can_access_contribution_record(pc.planner_user_id, pc.id)
    limit 1;

    if _effective_user_id is null then
      raise exception 'Access denied';
    end if;
  end if;

  select css.share_token
    into _share_token
  from public.contribution_summary_shares css
  where css.user_id = _effective_user_id
    and css.client_id is not distinct from _client_id
  limit 1;

  if _share_token is null then
    insert into public.contribution_summary_shares (user_id, client_id)
    values (_effective_user_id, _client_id)
    returning share_token into _share_token;
  end if;

  return _share_token;
end;
$$;

create or replace function public.get_shared_contributions_summary(_share_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _share record;
  _workspace_title text;
  _workspace_subtitle text;
  _budget_target numeric(12,2);
  _pledged_cash numeric(12,2);
  _collected_cash numeric(12,2);
  _in_kind_value numeric(12,2);
  _outstanding_pledges numeric(12,2);
  _pending_count integer;
  _contributor_count integer;
  _rounds jsonb;
begin
  select
    css.user_id,
    css.client_id,
    pc.client_name,
    pc.partner_name,
    p.wedding_name,
    p.full_name
  into _share
  from public.contribution_summary_shares css
  left join public.planner_clients pc on pc.id = css.client_id
  left join public.profiles p on p.id = css.user_id
  where css.share_token = _share_token
  limit 1;

  if _share.user_id is null then
    return null;
  end if;

  _workspace_title := coalesce(
    nullif(_share.client_name, ''),
    nullif(_share.wedding_name, ''),
    case
      when nullif(_share.full_name, '') is not null then _share.full_name || ' Wedding'
      else 'Wedding Contributions'
    end
  );

  _workspace_subtitle := coalesce(
    case
      when _share.client_id is not null and nullif(_share.partner_name, '') is not null
        then 'Shared contribution summary for ' || _share.client_name || ' & ' || _share.partner_name
      when _share.client_id is not null
        then 'Shared contribution summary for ' || _share.client_name
      else 'Shared contribution summary'
    end,
    'Shared contribution summary'
  );

  select coalesce(sum(bc.allocated), 0)
    into _budget_target
  from public.budget_categories bc
  where bc.user_id = _share.user_id
    and bc.client_id is not distinct from _share.client_id
    and bc.budget_scope = 'wedding';

  select
    coalesce(sum(wc.pledged_amount), 0),
    coalesce(sum(wc.paid_amount), 0),
    coalesce(sum(wc.in_kind_value), 0),
    coalesce(sum(
      case
        when wc.status = 'cancelled' or wc.contribution_type = 'in_kind' then 0
        else greatest(wc.pledged_amount - wc.paid_amount, 0)
      end
    ), 0),
    count(*) filter (where wc.status in ('pledged', 'partial')),
    count(distinct nullif(trim(wc.contributor_name), ''))
  into
    _pledged_cash,
    _collected_cash,
    _in_kind_value,
    _outstanding_pledges,
    _pending_count,
    _contributor_count
  from public.wedding_contributions wc
  where wc.user_id = _share.user_id
    and wc.client_id is not distinct from _share.client_id;

  select coalesce(
    jsonb_agg(round_data order by (round_data->>'starts_on') desc nulls last, (round_data->>'title')),
    '[]'::jsonb
  )
  into _rounds
  from (
    select jsonb_build_object(
      'title', cr.title,
      'goal_amount', cr.goal_amount,
      'starts_on', cr.starts_on,
      'ends_on', cr.ends_on,
      'is_active', cr.is_active,
      'notes', cr.notes,
      'pledged_cash', coalesce(sum(wc.pledged_amount), 0),
      'collected_cash', coalesce(sum(wc.paid_amount), 0),
      'in_kind_value', coalesce(sum(wc.in_kind_value), 0)
    ) as round_data
    from public.contribution_rounds cr
    left join public.wedding_contributions wc on wc.round_id = cr.id
    where cr.user_id = _share.user_id
      and cr.client_id is not distinct from _share.client_id
    group by cr.id, cr.title, cr.goal_amount, cr.starts_on, cr.ends_on, cr.is_active, cr.notes
  ) rounds_source;

  return jsonb_build_object(
    'workspace_title', _workspace_title,
    'workspace_subtitle', _workspace_subtitle,
    'budget_target', coalesce(_budget_target, 0),
    'pledged_cash', coalesce(_pledged_cash, 0),
    'collected_cash', coalesce(_collected_cash, 0),
    'in_kind_value', coalesce(_in_kind_value, 0),
    'total_support', coalesce(_collected_cash, 0) + coalesce(_in_kind_value, 0),
    'outstanding_pledges', coalesce(_outstanding_pledges, 0),
    'pending_count', coalesce(_pending_count, 0),
    'contributor_count', coalesce(_contributor_count, 0),
    'rounds', coalesce(_rounds, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.ensure_contribution_share_token(uuid) to authenticated;
grant execute on function public.get_shared_contributions_summary(uuid) to authenticated, anon;
