create table if not exists public.pricing_catalog (
  catalog_key text primary key,
  display_name text not null,
  is_active boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_catalog_config_is_object check (jsonb_typeof(config) = 'object')
);

create unique index if not exists pricing_catalog_one_active_idx
  on public.pricing_catalog (is_active)
  where is_active = true;

alter table public.pricing_catalog enable row level security;

revoke all on table public.pricing_catalog from public;
revoke all on table public.pricing_catalog from anon;
revoke all on table public.pricing_catalog from authenticated;

grant select on table public.pricing_catalog to anon;
grant select on table public.pricing_catalog to authenticated;
grant all on table public.pricing_catalog to service_role;

drop policy if exists "Active pricing catalogs are readable" on public.pricing_catalog;
create policy "Active pricing catalogs are readable"
on public.pricing_catalog
for select
to anon, authenticated
using (is_active = true);

drop trigger if exists update_pricing_catalog_updated_at on public.pricing_catalog;
create trigger update_pricing_catalog_updated_at
before update on public.pricing_catalog
for each row execute function public.update_updated_at_column();

insert into public.pricing_catalog (
  catalog_key,
  display_name,
  is_active,
  config
)
values (
  'default_live',
  'Default Live Pricing Catalog',
  true,
  $${
    "couplePlans": {
      "free": {
        "title": "Free",
        "tagline": "Plan your wedding on your own",
        "supportCopy": "Best for couples getting started with budgeting, vendor discovery, guests, and early planning.",
        "annualPriceKes": null,
        "monthlyPriceKes": null,
        "bundleCode": null,
        "stripeMonthlyLookupKey": null,
        "stripeAnnualLookupKey": null,
        "includedFeatures": [
          "Task list",
          "Cost estimator",
          "Budget tracking",
          "Vendor directory",
          "Vendor management",
          "Guest list"
        ],
        "ctaLabel": "Start free"
      },
      "basic": {
        "title": "Basic",
        "tagline": "Plan together",
        "supportCopy": "Stop planning alone. Bring your committee, family, planner, and vendors into one shared wedding workspace.",
        "annualPriceKes": 5000,
        "monthlyPriceKes": 750,
        "bundleCode": "couple_basic_annual",
        "stripeMonthlyLookupKey": "couple_basic_monthly",
        "stripeAnnualLookupKey": "couple_basic_annual",
        "includedFeatures": [
          "Everything in Free",
          "Planner collaboration",
          "Vendor collaboration",
          "Committee collaboration up to 10 people",
          "Family collaboration up to 10 people"
        ],
        "ctaLabel": "Upgrade to Basic"
      },
      "premium": {
        "title": "Premium",
        "tagline": "Run the whole wedding in one place",
        "supportCopy": "Turn your wedding into a fully coordinated workspace with AI support, collaborative timelines, and richer vendor and planner coordination.",
        "annualPriceKes": 15000,
        "monthlyPriceKes": 2000,
        "bundleCode": "couple_premium_annual",
        "stripeMonthlyLookupKey": "couple_premium_monthly",
        "stripeAnnualLookupKey": "couple_premium_annual",
        "includedFeatures": [
          "Everything in Basic",
          "Committee collaboration up to 20 people",
          "Family collaboration up to 20 people",
          "AI Wedding Assistant",
          "Vendor collaboration tools",
          "Planner collaboration tools",
          "Timeline management"
        ],
        "ctaLabel": "Go Premium"
      }
    },
    "coupleAddons": {
      "gift_registry_addon": {
        "title": "Gift Registry",
        "supportCopy": "Let guests buy directly from your wedding wishlist. Purchased items are automatically marked off so there are no duplicates.",
        "stripeMonthlyLookupKey": "gift_registry_addon",
        "stripeAnnualLookupKey": null
      },
      "guest_rsvp_management_addon": {
        "title": "Guest RSVP & Management",
        "supportCopy": "Collect RSVPs, track attendance, and manage guest coordination beyond a simple guest list.",
        "stripeMonthlyLookupKey": "guest_rsvp_management_addon",
        "stripeAnnualLookupKey": null
      }
    },
    "professionalPlans": {
      "planner": {
        "free": {
          "title": "Free",
          "tagline": "Get discovered on Zania",
          "supportCopy": "Best for planners who want a public profile, directory visibility, and a verified business presence before upgrading into operational tools.",
          "annualPriceKes": null,
          "monthlyPriceKes": null,
          "bundleCode": null,
          "stripeMonthlyLookupKey": null,
          "stripeAnnualLookupKey": null,
          "includedFeatures": [
            "Directory listing",
            "Basic public profile",
            "Verification eligibility"
          ],
          "ctaLabel": "Start free"
        },
        "premium": {
          "title": "Premium",
          "tagline": "Run your wedding business on Zania",
          "supportCopy": "Manage inquiries, bookings, payments, contracts, and public credibility in one business workspace designed for wedding professionals.",
          "annualPriceKes": 9000,
          "monthlyPriceKes": 1000,
          "bundleCode": "planner_premium_annual",
          "stripeMonthlyLookupKey": "planner_premium_monthly",
          "stripeAnnualLookupKey": "planner_premium_annual",
          "includedFeatures": [
            "Inquiries and bookings tracker",
            "Quotes, invoicing, and receipts",
            "Couple-linked payment tracking",
            "Contract management with reusable templates",
            "Public ratings from completed weddings"
          ],
          "ctaLabel": "Upgrade to Premium"
        }
      },
      "vendor": {
        "free": {
          "title": "Free",
          "tagline": "Get discovered on Zania",
          "supportCopy": "Best for vendors who want a public profile, directory visibility, and a verified business presence before upgrading into operational tools.",
          "annualPriceKes": null,
          "monthlyPriceKes": null,
          "bundleCode": null,
          "stripeMonthlyLookupKey": null,
          "stripeAnnualLookupKey": null,
          "includedFeatures": [
            "Directory listing",
            "Basic public profile",
            "Verification eligibility"
          ],
          "ctaLabel": "Start free"
        },
        "premium": {
          "title": "Premium",
          "tagline": "Run your wedding business on Zania",
          "supportCopy": "Manage inquiries, bookings, payments, contracts, and public credibility in one business workspace designed for wedding professionals.",
          "annualPriceKes": 9000,
          "monthlyPriceKes": 1000,
          "bundleCode": "vendor_premium_annual",
          "stripeMonthlyLookupKey": "vendor_premium_monthly",
          "stripeAnnualLookupKey": "vendor_premium_annual",
          "includedFeatures": [
            "Inquiries and bookings tracker",
            "Quotes, invoicing, and receipts",
            "Couple-linked payment tracking",
            "Contract management with reusable templates",
            "Public ratings from completed weddings"
          ],
          "ctaLabel": "Upgrade to Premium"
        }
      }
    },
    "professionalAddons": {
      "media_addon": {
        "audience": "shared",
        "title": "Media",
        "supportCopy": "Showcase your work with a richer photo and video portfolio experience beyond a basic profile.",
        "stripeMonthlyLookupKey": "media_addon",
        "stripeAnnualLookupKey": null,
        "seatLimit": null
      },
      "advertising_addon": {
        "audience": "shared",
        "title": "Advertising",
        "supportCopy": "Promote your listing through boosted placement, featured visibility, and directory marketing opportunities.",
        "stripeMonthlyLookupKey": "advertising_addon",
        "stripeAnnualLookupKey": null,
        "seatLimit": null
      },
      "team_workspace_bundle_3": {
        "audience": "shared",
        "title": "Team Workspace",
        "supportCopy": "Collaborate with colleagues inside Zania through a 3-seat team workspace bundle.",
        "stripeMonthlyLookupKey": "team_workspace_bundle_3",
        "stripeAnnualLookupKey": null,
        "seatLimit": 3
      },
      "team_workspace_bundle_5": {
        "audience": "shared",
        "title": "Team Workspace",
        "supportCopy": "Collaborate with colleagues inside Zania through a 5-seat team workspace bundle.",
        "stripeMonthlyLookupKey": "team_workspace_bundle_5",
        "stripeAnnualLookupKey": null,
        "seatLimit": 5
      },
      "team_workspace_bundle_10": {
        "audience": "shared",
        "title": "Team Workspace",
        "supportCopy": "Collaborate with colleagues inside Zania through a 10-seat team workspace bundle.",
        "stripeMonthlyLookupKey": "team_workspace_bundle_10",
        "stripeAnnualLookupKey": null,
        "seatLimit": 10
      }
    },
    "audiencePlans": {
      "couple": {
        "title": "Couples",
        "subtitle": "Free to explore, pay when you are ready to actively coordinate your wedding.",
        "pricingModel": "Wedding plan",
        "billingCadence": "one_time",
        "displayOneTimePriceKes": 15000,
        "displayMonthlyPriceKes": null,
        "displayAnnualPriceKes": null,
        "freeTierName": "Explore",
        "paidTierName": "Wedding Plan",
        "entitlementCode": "planning_pass",
        "stripeProductKey": "planning_pass",
        "stripeMonthlyLookupKey": null,
        "stripeAnnualLookupKey": null,
        "stripeOneTimeLookupKey": "planning_pass_one_time",
        "successPath": "/budget?upgrade=success",
        "cancelPath": "/pricing?upgrade=cancelled",
        "freeIncludes": [
          "Sign up and create a wedding workspace",
          "Use the cost estimator",
          "Browse planners and vendors",
          "Save favorites and build a shortlist",
          "Draft budget, tasks, and guest planning"
        ],
        "paidUnlocks": [
          "AI wedding assistant with workspace-aware guidance and actions",
          "Connect with vendors and planners",
          "Track vendor payments and balances",
          "Collaborate with committee members or a planner",
          "Export progress and reports",
          "Push schedules to Google Calendar"
        ],
        "upgradeMoments": [
          "Opening the AI assistant",
          "Trying to contact a vendor",
          "Trying to connect to a planner",
          "Inviting collaborators",
          "Exporting progress",
          "Syncing to Google Calendar"
        ]
      },
      "committee": {
        "title": "Wedding Committees",
        "subtitle": "Built like a couple pass, but for families and committee-led weddings.",
        "pricingModel": "One-time wedding pass",
        "billingCadence": "one_time",
        "displayOneTimePriceKes": 5000,
        "displayMonthlyPriceKes": null,
        "displayAnnualPriceKes": null,
        "freeTierName": "Explore",
        "paidTierName": "Committee Pass",
        "entitlementCode": "committee_pass",
        "stripeProductKey": "committee_pass",
        "stripeMonthlyLookupKey": null,
        "stripeAnnualLookupKey": null,
        "stripeOneTimeLookupKey": "committee_pass_one_time",
        "successPath": "/dashboard?upgrade=success",
        "cancelPath": "/pricing?upgrade=cancelled",
        "freeIncludes": [
          "Create a committee-led wedding workspace",
          "Estimate costs and draft the initial plan",
          "Browse planners and vendors",
          "Build shortlist, budget, and tasks",
          "Assign internal planning responsibilities"
        ],
        "paidUnlocks": [
          "AI committee assistant for planning and delegated execution",
          "Connect with vendors and planners",
          "Committee collaboration and delegated task ownership",
          "Vendor payment tracking",
          "Exports and reporting",
          "Google Calendar schedule sync"
        ],
        "upgradeMoments": [
          "Opening the AI assistant",
          "Trying to connect with a vendor",
          "Trying to collaborate at full committee level",
          "Recording detailed execution progress",
          "Exporting or syncing schedules"
        ]
      },
      "planner": {
        "title": "Professional Planners",
        "subtitle": "Start with a verified listing for discovery, then upgrade when you need operational tools for bookings, payments, contracts, and trust.",
        "pricingModel": "Monthly or annual subscription",
        "billingCadence": "monthly_or_annual",
        "displayOneTimePriceKes": null,
        "displayMonthlyPriceKes": 1000,
        "displayAnnualPriceKes": 9000,
        "freeTierName": "Free",
        "paidTierName": "Premium",
        "entitlementCode": "booking_management",
        "stripeProductKey": "planner_premium",
        "stripeMonthlyLookupKey": "planner_premium_monthly",
        "stripeAnnualLookupKey": "planner_premium_annual",
        "stripeOneTimeLookupKey": null,
        "successPath": "/clients?upgrade=success",
        "cancelPath": "/pricing?upgrade=cancelled",
        "freeIncludes": [
          "Directory listing",
          "Basic public profile",
          "Verification eligibility"
        ],
        "paidUnlocks": [
          "Inquiries and bookings tracker",
          "Quotes, invoicing, and receipts",
          "Couple-linked payment tracking",
          "Contract management with reusable templates",
          "Public ratings from completed weddings"
        ],
        "upgradeMoments": [
          "Trying to manage inquiries or bookings",
          "Trying to create quotes or invoices",
          "Trying to manage contracts",
          "Trying to surface public ratings",
          "Trying to use premium portfolio or growth tools"
        ]
      },
      "vendor": {
        "title": "Vendors",
        "subtitle": "Start with a verified listing for discovery, then upgrade when you need operational tools for bookings, payments, contracts, and trust.",
        "pricingModel": "Monthly or annual subscription",
        "billingCadence": "monthly_or_annual",
        "displayOneTimePriceKes": null,
        "displayMonthlyPriceKes": 1000,
        "displayAnnualPriceKes": 9000,
        "freeTierName": "Free",
        "paidTierName": "Premium",
        "entitlementCode": "booking_management",
        "stripeProductKey": "vendor_premium",
        "stripeMonthlyLookupKey": "vendor_premium_monthly",
        "stripeAnnualLookupKey": "vendor_premium_annual",
        "stripeOneTimeLookupKey": null,
        "successPath": "/vendor-dashboard?upgrade=success",
        "cancelPath": "/pricing?upgrade=cancelled",
        "freeIncludes": [
          "Directory listing",
          "Basic public profile",
          "Verification eligibility"
        ],
        "paidUnlocks": [
          "Inquiries and bookings tracker",
          "Quotes, invoicing, and receipts",
          "Couple-linked payment tracking",
          "Contract management with reusable templates",
          "Public ratings from completed weddings"
        ],
        "upgradeMoments": [
          "Trying to manage inquiries or bookings",
          "Trying to create quotes or invoices",
          "Trying to manage contracts",
          "Trying to surface public ratings",
          "Trying to use premium portfolio or growth tools"
        ]
      }
    },
    "checkout": {
      "allowedLookupKeys": [
        "planning_pass_one_time",
        "committee_pass_one_time",
        "planner_premium_monthly",
        "planner_premium_annual",
        "vendor_premium_monthly",
        "vendor_premium_annual",
        "couple_basic_monthly",
        "couple_basic_annual",
        "couple_premium_monthly",
        "couple_premium_annual",
        "gift_registry_addon",
        "guest_rsvp_management_addon",
        "media_addon",
        "advertising_addon",
        "team_workspace_bundle_3",
        "team_workspace_bundle_5",
        "team_workspace_bundle_10"
      ],
      "coupleCheckoutMap": {
        "planning_pass_one_time": {
          "bundleCode": "planning_pass_one_time",
          "bundleType": "wedding_pass",
          "features": [
            "wedding_collaboration",
            "planner_collaboration",
            "vendor_collaboration",
            "committee_collaboration",
            "family_collaboration",
            "timeline_management",
            "ai_wedding_assistant"
          ],
          "couplePlanTier": "premium",
          "seatLimits": {
            "committee": 20,
            "family": 20
          },
          "syncLegacyPlanningPass": true
        },
        "couple_basic_monthly": {
          "bundleCode": "couple_basic_monthly",
          "bundleType": "wedding_pass",
          "features": [
            "wedding_collaboration",
            "planner_collaboration",
            "vendor_collaboration",
            "committee_collaboration",
            "family_collaboration"
          ],
          "couplePlanTier": "basic",
          "seatLimits": {
            "committee": 10,
            "family": 10
          },
          "syncLegacyPlanningPass": false
        },
        "couple_basic_annual": {
          "bundleCode": "couple_basic_annual",
          "bundleType": "wedding_pass",
          "features": [
            "wedding_collaboration",
            "planner_collaboration",
            "vendor_collaboration",
            "committee_collaboration",
            "family_collaboration"
          ],
          "couplePlanTier": "basic",
          "seatLimits": {
            "committee": 10,
            "family": 10
          },
          "syncLegacyPlanningPass": false
        },
        "couple_premium_monthly": {
          "bundleCode": "couple_premium_monthly",
          "bundleType": "wedding_pass",
          "features": [
            "wedding_collaboration",
            "planner_collaboration",
            "vendor_collaboration",
            "committee_collaboration",
            "family_collaboration",
            "timeline_management",
            "ai_wedding_assistant"
          ],
          "couplePlanTier": "premium",
          "seatLimits": {
            "committee": 20,
            "family": 20
          },
          "syncLegacyPlanningPass": true
        },
        "couple_premium_annual": {
          "bundleCode": "couple_premium_annual",
          "bundleType": "wedding_pass",
          "features": [
            "wedding_collaboration",
            "planner_collaboration",
            "vendor_collaboration",
            "committee_collaboration",
            "family_collaboration",
            "timeline_management",
            "ai_wedding_assistant"
          ],
          "couplePlanTier": "premium",
          "seatLimits": {
            "committee": 20,
            "family": 20
          },
          "syncLegacyPlanningPass": true
        },
        "gift_registry_addon": {
          "bundleCode": "gift_registry_addon",
          "bundleType": "registry_addon",
          "features": [
            "gift_registry"
          ],
          "couplePlanTier": null,
          "seatLimits": null,
          "syncLegacyPlanningPass": false
        },
        "guest_rsvp_management_addon": {
          "bundleCode": "guest_rsvp_management_addon",
          "bundleType": "guest_rsvp_addon",
          "features": [
            "guest_rsvp_management"
          ],
          "couplePlanTier": null,
          "seatLimits": null,
          "syncLegacyPlanningPass": false
        }
      },
      "professionalCheckoutMap": {
        "media_addon": {
          "features": [
            "media_portfolio"
          ]
        },
        "advertising_addon": {
          "features": [
            "advertising"
          ]
        },
        "team_workspace_bundle_3": {
          "features": [
            "team_workspace"
          ],
          "seatLimit": 3
        },
        "team_workspace_bundle_5": {
          "features": [
            "team_workspace"
          ],
          "seatLimit": 5
        },
        "team_workspace_bundle_10": {
          "features": [
            "team_workspace"
          ],
          "seatLimit": 10
        }
      }
    }
  }$$::jsonb
)
on conflict (catalog_key) do update
set
  display_name = excluded.display_name,
  is_active = excluded.is_active,
  config = excluded.config,
  updated_at = now();
