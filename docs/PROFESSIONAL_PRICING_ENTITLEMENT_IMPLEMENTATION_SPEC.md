# Professional Pricing And Entitlement Implementation Spec

## Approved Model

Planner and vendor accounts use the same two-tier commercial structure:

- `Free`: get discovered and participate when a couple brings the professional into a Collaborative wedding.
- `Professional`: run the professional's wider wedding business on Zania.

There are no professional subscription add-ons. Advertising is a separate future product, and Team Workspace will be released inside Professional when it is ready.

## Pricing

Professional costs:

- KES 1,000 per month
- KES 9,000 per year

The existing internal `premium` tier and `*_premium_*` lookup keys remain unchanged for data and checkout compatibility. Customer-facing copy must call the tier `Professional`.

## Feature Matrix

| Capability | Free | Professional |
|---|---|---|
| Directory listing | Included after verification | Included after verification |
| Basic profile and portfolio | Included | Included |
| Verification eligibility | Included | Included |
| Public ratings from completed weddings | Included | Included |
| Receive invitations and inquiries | Included | Included |
| Participate in a couple-funded workspace | Included | Included |
| Multiple active weddings and business pipeline | Not included | Included |
| Quotes, invoices, and receipts | Not included | Included |
| Couple-linked payment tracking | Not included | Included |
| Contracts and reusable templates | Not included | Included |
| Advanced portfolio presentation | Not included | Included |
| Business analytics | Not included | Included |
| New professional workflow features | Not included | Included as released |
| Team workspace | Coming soon | Coming soon inside Professional |

## Billing Rule

Collaboration must never be double-charged. When a couple owns an active Collaborative wedding, invited verified planners and vendors can participate without purchasing Professional.

Professional is account-owned rather than wedding-owned. It is required when Zania becomes the planner's or vendor's wider business operating system.

## Trust Rule

Verification and public ratings are trust infrastructure, not paid benefits:

- payment cannot bypass verification
- verified Free listings can appear publicly
- ratings can only come from genuine completed wedding relationships
- negative or positive ratings cannot be hidden based on subscription status

## Entitlements

Professional checkout activates:

- `booking_management`
- `invoicing`
- `contract_management`
- `media_portfolio`

The legacy entitlement keys `advertising` and `team_workspace` remain valid for historical records, but no active checkout product sells them.

Monthly entitlements expire one month after verified payment. Annual entitlements expire one year after verified payment. Activation also updates the existing planner or vendor subscription status fields used by current workspace gates.

## Paystack Products

- `planner_premium_monthly`
- `planner_premium_annual`
- `vendor_premium_monthly`
- `vendor_premium_annual`

Paystack callback sync and the signed webhook both use the same idempotent activation logic. This ensures access is granted even when the customer does not return to Zania after checkout.

## Upgrade Language

Use:

- `Upgrade to Professional`
- `Run your wider wedding business on Zania`
- `Free includes collaboration when a couple brings you into their workspace`

Do not use:

- `Planner Pro`
- `Vendor Pro`
- `Premium` in customer-facing tier names
- add-on purchase prompts
