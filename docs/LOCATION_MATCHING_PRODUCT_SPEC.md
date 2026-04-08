# Location Matching Product Spec

## Goal

Make location a first-class matching signal across Zania so that:

- couples and committees can tell the platform where the wedding will happen
- planners and vendors can tell the platform where they are based and where they work
- directories can rank professionals by location relevance and budget fit

## Core Product Decisions

### 1. Wedding location is structured

For couples and committees we store:

- `wedding_county`
- `wedding_town`

We still keep the existing `wedding_location` text field for compatibility, but it is derived from the structured fields.

### 2. Business location is structured

For planners and vendors we store:

- `primary_county`
- `primary_town`
- `service_areas`
- `travel_scope`

This makes it possible to distinguish:

- where a business is based
- where it actually serves clients

### 3. Budget fit is a matching signal

For planners and vendors we store:

- `minimum_budget_kes`
- `maximum_budget_kes`

Directories use a couple or committee's wedding budget total, when available, to show whether a planner or vendor is a likely budget fit.

### 4. Matching must explain itself

We should not just rank results silently. Cards should show why they appear near the top, for example:

- `Near your wedding location`
- `Works in your county`
- `Fits your budget`
- `Travels nationwide`

## First Implementation Scope

### Schema

#### `profiles`

Add:

- `wedding_county text`
- `wedding_town text`
- `primary_county text`
- `primary_town text`
- `service_areas text[]`
- `travel_scope text`
- `minimum_budget_kes numeric`
- `maximum_budget_kes numeric`

#### `vendor_listings`

Add:

- `location_county text`
- `location_town text`
- `service_areas text[]`
- `travel_scope text`
- `minimum_budget_kes numeric`
- `maximum_budget_kes numeric`

### Sign-up and Settings

#### Couples and committees

Capture:

- wedding county
- wedding town

#### Planners and vendors

Capture:

- primary county
- primary town

#### Professional settings

Allow editing:

- service areas
- travel scope
- budget range

### Directories

#### Vendor directory

Use:

- same town
- same county
- service area match
- budget fit

to sort results for couples and committees.

#### Planner directory

Use the same signals for planner discovery.

## Matching Logic

### Location ranking order

1. same town
2. same county
3. wedding county appears in service areas
4. provider travels nationwide

### Budget ranking

If a wedding budget total exists:

- budget within min/max -> `Fits your budget`
- otherwise no positive budget-fit badge

We should avoid punishing results too aggressively when budget data is missing.

## Kenya Location Structure

We use:

- county dropdown first
- town/area dropdown second

This is easier to understand than one giant list.

The shared structure should live in code so the same dataset powers:

- auth
- settings
- planner directory
- vendor directory
- future estimator improvements

## Future Improvements

### 1. Availability

Add:

- available months
- fully booked dates

### 2. Style matching

Add optional tags such as:

- intimate
- classic
- garden
- luxury
- traditional

### 3. Travel fee / travel policy

Add:

- travel fee yes/no
- extra county fee notes

### 4. Match explanation chips

Show 1-3 chips per result to build trust in the ranking.

