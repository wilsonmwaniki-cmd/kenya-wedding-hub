# Production Cutover

This guide is for the real launch path where you control the backend.

## Goal

Move from the current prototype setup to a production setup you own:

1. Create a Supabase project you control.
2. Run all migrations from this repository into that project.
3. Create a new Lovable project connected to that Supabase project.
4. Publish that new Lovable project as the real production app.
5. Bootstrap your first admin user.

## Why this is the correct launch model

The current Lovable project is locked to its existing backend. That is fine for testing, but it is not the right long-term production model if you need control over:

- billing
- backups
- auth users
- SQL access
- migrations
- recovery

## Step 1: Create the production Supabase project

Create a new Supabase project in your own account. Save:

- the project ref
- the database password
- the project URL
- the anon public key

## Step 2: Run all migrations into the new Supabase project

From the repository root, run:

```bash
cd /Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub
NPM_CONFIG_CACHE=/tmp/.npm-cache npx --yes supabase@2.77.0 login
NPM_CONFIG_CACHE=/tmp/.npm-cache npx --yes supabase@2.77.0 link --project-ref YOUR_PROJECT_REF
NPM_CONFIG_CACHE=/tmp/.npm-cache npx --yes supabase@2.77.0 db push --include-all
```

If prompted, enter the database password for the new project.

## Step 3: Verify tables exist

Run this in Supabase SQL Editor:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

You should see tables like:

- `profiles`
- `user_roles`
- `tasks`
- `guests`
- `vendor_listings`

## Step 4: Create the real production Lovable project

Do not keep using the locked prototype project for real launch.

Create a new Lovable project and connect it to the new Supabase project from the start. Then publish that new Lovable project.

The production Lovable project should point to the new Supabase project, not the old locked backend.

## Step 5: Create or sign in the owner account

Use the production app and sign up with the owner email. This ensures the user exists in `auth.users`.

## Step 6: Bootstrap admin access

Run the SQL in:

- [bootstrap_admin.sql](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/supabase/sql/bootstrap_admin.sql)

Replace the placeholder email before running it.

## Step 7: Verify the admin portal

1. Log out of the app.
2. Log back in.
3. Open `/admin`.

Expected result:

- admin portal loads
- user role management works
- vendor moderation works

## Recommended launch sequence

1. Finish production Supabase setup.
2. Publish the new Lovable project.
3. Test auth, dashboard, CRUD, AI chat, and admin portal.
4. Add your custom domain.
5. Only then onboard real users.

## Data migration note

If you need data from the old prototype backend, export it and import it into the new Supabase project before launch. Migrate only the data you want to preserve:

- users
- profiles
- planner clients
- budget data
- tasks
- guests
- vendors
- vendor listings

## Important rule

Launch real users only on the new controlled stack. Do not split live users across the old locked backend and the new Supabase project.
