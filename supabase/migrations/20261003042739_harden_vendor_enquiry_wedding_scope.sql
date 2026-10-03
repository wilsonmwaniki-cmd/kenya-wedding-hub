-- Qualify outer-row references inside the enquiry policies. Unqualified
-- wedding_id references inside a correlated subquery resolve to the inner
-- table's wedding_id, which turns the intended cross-table equality into a
-- self-comparison.

drop policy if exists "Enquiry participants can view their enquiries"
  on public.vendor_enquiries;

create policy "Enquiry participants can view their enquiries"
on public.vendor_enquiries for select to authenticated
using (
  vendor_enquiries.owner_user_id = (select auth.uid())
  or vendor_enquiries.initiated_by_user_id = (select auth.uid())
  or vendor_enquiries.approved_by_user_id = (select auth.uid())
  or exists (
    select 1
    from public.planner_clients pc
    where pc.id = vendor_enquiries.planner_client_id
      and pc.linked_user_id = (select auth.uid())
  )
);

drop policy if exists "Wedding managers can create their enquiries"
  on public.vendor_enquiries;

create policy "Wedding managers can create their enquiries"
on public.vendor_enquiries for insert to authenticated
with check (
  vendor_enquiries.owner_user_id = (select auth.uid())
  and (
    public.can_manage_wedding_memberships(vendor_enquiries.wedding_id)
    or exists (
      select 1
      from public.planner_clients pc
      where pc.id = vendor_enquiries.planner_client_id
        and pc.wedding_id = vendor_enquiries.wedding_id
        and pc.planner_user_id = (select auth.uid())
        and pc.is_archived = false
        and pc.linked_user_id is null
    )
  )
  and exists (
    select 1
    from public.vendors v
    where v.id = vendor_enquiries.vendor_id
      and v.wedding_id = vendor_enquiries.wedding_id
  )
);

-- These tables deliberately have no authenticated DELETE policy. Remove the
-- inherited table privilege as a matching least-privilege boundary.
revoke delete on table public.intelligence_gateway_confirmations from authenticated;
revoke delete on table public.vendor_enquiries from authenticated;
revoke delete on table public.vendor_negotiation_profiles from authenticated;
