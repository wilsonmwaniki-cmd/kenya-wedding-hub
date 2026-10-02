create table public.professional_review_invites (
  id uuid primary key default gen_random_uuid(),
  professional_user_id uuid not null references auth.users(id) on delete cascade,
  professional_type text not null check (professional_type in ('vendor', 'planner')),
  vendor_listing_id uuid null references public.vendor_listings(id) on delete cascade,
  planner_profile_id uuid null references public.profiles(id) on delete cascade,
  professional_name text not null check (char_length(professional_name) between 1 and 160),
  couple_name text not null check (char_length(couple_name) between 1 and 120),
  couple_email text not null check (
    couple_email = lower(couple_email)
    and char_length(couple_email) between 3 and 320
  ),
  token_hash text not null unique check (char_length(token_hash) = 64),
  status text not null default 'sent' check (status in ('sent', 'completed', 'revoked')),
  expires_at timestamptz not null default (now() + interval '30 days'),
  used_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (professional_type = 'vendor' and vendor_listing_id is not null and planner_profile_id is null)
    or
    (professional_type = 'planner' and planner_profile_id is not null and vendor_listing_id is null)
  )
);

create index professional_review_invites_owner_created_idx
  on public.professional_review_invites (professional_user_id, created_at desc);

create index professional_review_invites_active_token_idx
  on public.professional_review_invites (token_hash)
  where status = 'sent';

create unique index professional_review_invites_vendor_email_unique
  on public.professional_review_invites (vendor_listing_id, couple_email)
  where vendor_listing_id is not null and status in ('sent', 'completed');

create unique index professional_review_invites_planner_email_unique
  on public.professional_review_invites (planner_profile_id, couple_email)
  where planner_profile_id is not null and status in ('sent', 'completed');

create table public.professional_reviews (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null unique references public.professional_review_invites(id) on delete restrict,
  professional_user_id uuid not null references auth.users(id) on delete cascade,
  professional_type text not null check (professional_type in ('vendor', 'planner')),
  vendor_listing_id uuid null references public.vendor_listings(id) on delete cascade,
  planner_profile_id uuid null references public.profiles(id) on delete cascade,
  reviewer_name text not null check (char_length(reviewer_name) between 1 and 120),
  rating smallint not null check (rating between 1 and 5),
  review_text text null check (review_text is null or char_length(review_text) <= 2000),
  status text not null default 'published' check (status in ('published', 'hidden', 'flagged')),
  professional_reply text null check (professional_reply is null or char_length(professional_reply) <= 1200),
  replied_at timestamptz null,
  published_at timestamptz null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (professional_type = 'vendor' and vendor_listing_id is not null and planner_profile_id is null)
    or
    (professional_type = 'planner' and planner_profile_id is not null and vendor_listing_id is null)
  )
);

create index professional_reviews_vendor_published_idx
  on public.professional_reviews (vendor_listing_id, created_at desc)
  where status = 'published';

create index professional_reviews_planner_published_idx
  on public.professional_reviews (planner_profile_id, created_at desc)
  where status = 'published';

create index professional_reviews_owner_created_idx
  on public.professional_reviews (professional_user_id, created_at desc);

drop trigger if exists update_professional_review_invites_updated_at on public.professional_review_invites;
create trigger update_professional_review_invites_updated_at
before update on public.professional_review_invites
for each row execute function public.update_updated_at_column();

drop trigger if exists update_professional_reviews_updated_at on public.professional_reviews;
create trigger update_professional_reviews_updated_at
before update on public.professional_reviews
for each row execute function public.update_updated_at_column();

alter table public.professional_review_invites enable row level security;
alter table public.professional_reviews enable row level security;

create policy "Professionals can view their review invitations"
on public.professional_review_invites
for select
to authenticated
using (
  (select auth.uid()) = professional_user_id
  or public.has_role((select auth.uid()), 'admin'::public.app_role)
);

create policy "Published professional reviews are public"
on public.professional_reviews
for select
to anon, authenticated
using (
  status = 'published'
  or (select auth.uid()) = professional_user_id
  or public.has_role((select auth.uid()), 'admin'::public.app_role)
);

create policy "Admins can moderate professional reviews"
on public.professional_reviews
for update
to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role))
with check (public.has_role((select auth.uid()), 'admin'::public.app_role));

grant select on public.professional_review_invites to authenticated;
grant select on public.professional_reviews to anon, authenticated;
grant update (status, published_at) on public.professional_reviews to authenticated;

create or replace function public.consume_professional_review_invite(
  token_hash_input text,
  reviewer_name_input text,
  rating_input smallint,
  review_text_input text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_row public.professional_review_invites%rowtype;
  review_id uuid;
  normalized_name text := btrim(reviewer_name_input);
  normalized_review text := nullif(btrim(review_text_input), '');
begin
  if token_hash_input is null or char_length(token_hash_input) <> 64 then
    raise exception 'Invalid review invitation' using errcode = '22023';
  end if;

  if normalized_name is null or char_length(normalized_name) not between 1 and 120 then
    raise exception 'A reviewer name is required' using errcode = '22023';
  end if;

  if rating_input is null or rating_input not between 1 and 5 then
    raise exception 'Rating must be between 1 and 5' using errcode = '22023';
  end if;

  if normalized_review is not null and char_length(normalized_review) > 2000 then
    raise exception 'Review text is too long' using errcode = '22023';
  end if;

  select *
  into invite_row
  from public.professional_review_invites
  where token_hash = token_hash_input
  for update;

  if not found
    or invite_row.status <> 'sent'
    or invite_row.expires_at <= now()
    or invite_row.used_at is not null then
    raise exception 'This review invitation is invalid or has expired' using errcode = 'P0001';
  end if;

  insert into public.professional_reviews (
    invite_id,
    professional_user_id,
    professional_type,
    vendor_listing_id,
    planner_profile_id,
    reviewer_name,
    rating,
    review_text
  ) values (
    invite_row.id,
    invite_row.professional_user_id,
    invite_row.professional_type,
    invite_row.vendor_listing_id,
    invite_row.planner_profile_id,
    normalized_name,
    rating_input,
    normalized_review
  )
  returning id into review_id;

  update public.professional_review_invites
  set status = 'completed', used_at = now()
  where id = invite_row.id;

  return review_id;
end;
$$;

comment on function public.consume_professional_review_invite(text, text, smallint, text) is
  'Atomically consumes a single-use guest review token. Callable only by the service role through the professional-reviews Edge Function.';

revoke all on function public.consume_professional_review_invite(text, text, smallint, text)
  from public, anon, authenticated;
grant execute on function public.consume_professional_review_invite(text, text, smallint, text)
  to service_role;
