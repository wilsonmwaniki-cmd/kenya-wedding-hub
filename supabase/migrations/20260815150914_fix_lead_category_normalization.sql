-- Normalize case before stripping punctuation so capitalized category names match.
create or replace function lead_marketplace_private.canonical_category(value text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '', 'g')
    when 'catering' then 'Caterer'
    when 'caterer' then 'Caterer'
    when 'cake' then 'Cake Artist & Baker'
    when 'cakeartistbaker' then 'Cake Artist & Baker'
    when 'photography' then 'Photographer'
    when 'photographer' then 'Photographer'
    when 'videography' then 'Cinematographer'
    when 'videographer' then 'Cinematographer'
    when 'cinematographer' then 'Cinematographer'
    when 'mc' then 'Master of Ceremonies'
    when 'masterofceremonies' then 'Master of Ceremonies'
    when 'venue' then 'Wedding Venue'
    when 'weddingvenue' then 'Wedding Venue'
    when 'planning' then 'Wedding Planner / Planning Team'
    when 'planner' then 'Wedding Planner / Planning Team'
    when 'weddingplannerplanningteam' then 'Wedding Planner / Planning Team'
    when 'decor' then 'Décor, Tents, Chairs, Tables'
    when 'decortentschairstables' then 'Décor, Tents, Chairs, Tables'
    when 'attire' then 'Bridal Gown, Accessories, Preparation'
    when 'bridalgownaccessoriespreparation' then 'Bridal Gown, Accessories, Preparation'
    when 'beauty' then 'Bride''s Makeup'
    when 'transportation' then 'Transport'
    else nullif(btrim(value), '')
  end;
$$;

revoke all on function lead_marketplace_private.canonical_category(text)
from public, anon, authenticated;
;
