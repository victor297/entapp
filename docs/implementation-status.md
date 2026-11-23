# Frontend checklist and backend dependencies

Reviewed against the backend source in this workspace on 9 November 2026. All implementation changes are in `frontend/`. No backend code or production data was changed. The deployed API may differ from this checkout.

**Implemented** means connected to an existing contract and checked locally. **Partial** identifies the supported portion and its remaining dependency. **Blocked** needs backend support. **Deferred** needs the product or workflow decision specified in the checklist. An unavailable page is not counted as an implemented backend workflow.

## Main remaining dependencies

1. Customer/provider accounts cannot read `/admin/app-settings`. Booking creation requires its exact `serviceCharge`. Booking confirmation is disabled when that fee cannot be obtained; there is no hardcoded substitute. A public fee or booking-preview endpoint is needed to restore new customer/provider booking submissions.
2. The booking and quote services drop the `customerId` filter. Customer bookings are discovered safely through the customer's invoices and checked individually. Quotes submitted in this browser retain direct links. Complete customer booking and quote history needs backend scoping.
3. Quote status is currently `InvoiceStatus`, and its update DTO validates a different enum. Accept/reject/decline and accepted-quote conversion need a consistent finalized workflow.
4. Booking rescheduling does not map the supplied slot IDs into the database relations. The booking enum has no `COMPLETED`. Cancellation updates status, but does not itself release slots or confirm a refund.
5. Refund and withdrawal RPC handlers and service implementations are commented out. Saved bank accounts and customer saved payment methods have no usable contracts. These pages explain availability without fake success actions.
6. Notification list/read handlers and review routes are disabled. There are no fabricated notifications, unread counts, reviews or testimonials.
7. Fee creation/editing is connected, but `CreateFeeDto` applies string-length validation to a numeric amount and rejects the short `KYC` name. The frontend sends the intended numeric contract and displays errors; backend validators need correction.
8. Promotion activation, moderation, commission, KYC and external-customer workflows need backend/product completion.

## Listing discovery

Implementation: `lib/public-listings.ts`, `lib/listing-filters.ts`, `components/listings/`, `components/ui/card.tsx`, `components/ui/BookmarkButton.tsx`, `app/saved-listings/`, and `lib/seo.ts`.

| ID | Status | Current behavior / remaining work |
| --- | --- | --- |
| LIST-01 | Implemented | Public catalogues filter through backend requests before pagination. Matches outside the original first page are discoverable. |
| LIST-02 | Partial | Venue search passes supported price, capacity, amenities, event type, location and text filters. Catering supports text, state and city; its price/capacity/amenity/event-type filtering needs backend support. Category selects the appropriate catalogue. |
| LIST-03 | Implemented | Homepage search applies the available category, text and location fields. |
| LIST-04 | Implemented | Venue and catering catalogues have free-text search. |
| LIST-05 | Partial | Save/unsave uses the existing bookmark endpoint. Login and successful toggles supply authoritative saved IDs. Refresh across devices needs a customer-readable profile/bookmark endpoint; signing in again refreshes the snapshot. |
| LIST-06 | Implemented | Listing cards and public details have save controls. |
| LIST-07 | Partial | Customers can open Saved Listings using the synchronized bookmark snapshot, with explicit guidance for older sessions. Cross-device refresh has the LIST-05 dependency. |
| LIST-08 | Implemented | Provider listings show active, inactive, expired and absent subscription states using returned status/expiry. |
| LIST-09 | Blocked | Backend has no finalized booking-mode flag. Existing booking/quote entry points are retained; no mode is inferred from unrelated payment flags. New booking submission also has the service-fee dependency above. |
| LIST-10 | Implemented | Missing and failed listing photos use the bundled fallback image. |
| LIST-11 | Implemented | Public catalogue and detail content renders in initial server HTML. Missing listing IDs return HTTP 404. |
| LIST-12 | Partial | Dynamic titles, descriptions, canonical paths and social tags are present. Set `NEXT_PUBLIC_SITE_URL` to the actual frontend origin in deployment so absolute canonical/social URLs resolve correctly. It is currently missing from the local `.env`. |

## Bookings

Implementation: `components/operations/BookingsPage.tsx`, `BookingDetails.tsx`, `ManualBooking.tsx`, `components/ui/DatePicker.tsx`, and `lib/scoped-records.ts`.

| ID | Status | Current behavior / remaining work |
| --- | --- | --- |
| BOOK-01 | Implemented | Provider retrieval uses `serviceProvider` and traverses all pages across owned listings. It no longer relies on one listing's first page. |
| BOOK-02 | Implemented | Listing filters apply to the complete scoped result set. |
| BOOK-03 | Implemented | Explicit creation-date ranges work after fetching all scoped pages. Backend event-date filtering is not reliable yet. |
| BOOK-04 | Partial | Cancellation has policy information and an explicit confirmation. Status PATCH is supported; automatic slot release/refund processing still needs backend fixes. |
| BOOK-05 | Partial | Supported customer/provider notes can be edited. Date rescheduling is unavailable until the backend relation update works. |
| BOOK-06 | Partial | Actual pending/confirmed/reserved/postponed/cancelled values are normalized. Future `COMPLETED` is displayed, but the current backend does not produce it. |
| BOOK-07 | Partial | Partial/deposit payment states and real invoice amounts are displayed. Customer invoice remaining amounts use real invoice-payment wallet debits. A dedicated booking balance preview is still needed for a complete provider balance summary. |
| BOOK-08 | Implemented | Providers can create a server-calculated remaining-balance invoice when a booking is partially paid and its existing invoices are paid. No client-entered balance is sent. |
| BOOK-09 | Partial | Customers can pay balance invoices through actual gateways or an eligible wallet. Card top-ups of an already partially paid invoice are disabled because initiation currently charges the original invoice amount. |
| BOOK-10 | Blocked | Hardcoded fee removed from booking confirmation. Admins can edit/read the real fixed fee, but customer/provider fee retrieval needs a permitted endpoint. |
| BOOK-11 | Partial | Actual listing terms and cancellation policy appear before confirmation. An authoritative refund-amount preview is unavailable. |
| BOOK-12 | Partial | A returned `COMPLETED` value renders as Completed; paid or past bookings are not falsely labeled completed. The current backend enum still lacks completion. |
| BOOK-13 | Deferred | No manual completion action is exposed before the backend workflow requires and supports it. |
| BOOK-14 | Blocked | Requires deployment of the backend availability/double-booking fixes and a real integration test environment. Local availability loading now traverses all pages. |

Customer booking retrieval does not download the global booking directory. It follows booking IDs from `/invoice?userId=<current customer>`, deduplicates IDs and checks each returned booking's owner. Bookings without invoices cannot be discovered through this fallback.

## Quotes

Implementation: `components/operations/QuoteRequestForm.tsx`, `QuotesPage.tsx`, `ManualBooking.tsx`, and `lib/quote-details.ts`.

| ID | Status | Current behavior / remaining work |
| --- | --- | --- |
| QUOTE-01 | Partial | Screens use actual backend status values and existing linked bookings. Unsupported `Approved` conversion logic is disconnected. New conversion needs the finalized status and fee contracts. |
| QUOTE-02 | Blocked | Accept/reject needs a consistent backend quote status/update workflow. |
| QUOTE-03 | Blocked | Decline reason needs a supported rejection contract. |
| QUOTE-04 | Partial | Fake customer identities are removed. Details use real nested customer information if returned, otherwise the actual customer reference. Providers cannot call the admin-only user directory for names/emails. |
| QUOTE-05 | Implemented | Numeric minimum/maximum budget fields validate the range. The supported string budget and structured notes retain the values. |
| QUOTE-06 | Implemented | Provider quote management supports creation-date and listing filters over all provider pages. |
| QUOTE-07 | Implemented | Requests capture event date, guests, event type, menu, dietary needs, allergies, drinks, staffing, equipment, notes, slots and billing address. Structured details are stored in supported `customerNotes`. |
| QUOTE-08 | Implemented | Provider quote details display the structured requirements and handle older plain-text notes. |
| QUOTE-09 | Blocked | No working quote messaging contract. |
| QUOTE-10 | Blocked | Conversation history and message status depend on messaging support. Quote reads/submission have loading and error states. |
| QUOTE-11 | Blocked | Existing linked bookings can be accessed. Creating a booking from an accepted quote needs finalized acceptance/conversion and readable booking fees. |

## Payments and invoices

Implementation: `components/operations/FinancePage.tsx`, `PaymentStatusPage.tsx`, `BookingDetails.tsx`, `lib/payment-status.ts`, and the existing gateway modals. The obsolete mock payment page redirects to real invoices.

| ID | Status | Current behavior / remaining work |
| --- | --- | --- |
| PAY-01 | Implemented | Provider wallet dashboard is available. |
| PAY-02 | Implemented | Balance and paginated transaction history come from JWT-scoped wallet endpoints. |
| PAY-03 | Blocked | Backend returns a balance, without a separate customer/provider held-balance breakdown. The UI explains this. |
| PAY-04 | Implemented | Eligible customers can confirm payment of an owned booking invoice from a sufficient wallet balance in the same currency. Backend payment status is checked afterward. |
| PAY-05 | Blocked | Mock cards are removed from active settings/checkout. Real saved customer payment methods have no endpoint. Gateway configuration is not treated as saved cards. |
| PAY-06 | Blocked | No default saved-payment-method contract. |
| PAY-07 | Implemented | `/payment` preserves the invoice ID and redirects to actual checkout. |
| PAY-08 | Implemented | Failed initiation and cancelled/failed Stripe attempts permit a new provider attempt. |
| PAY-09 | Implemented | Success requires an owned backend invoice with `PAID`/`OVER_PAID`. A callback query/reference is not proof. The calendar's Stripe callback also goes through verification. |
| PAY-10 | Implemented | Admin revenue ledger uses platform wallet transactions. |
| PAY-11 | Implemented | All booking invoices are listed, including deposit and remaining-balance invoices. |
| PAY-12 | Implemented | Supported balance invoice creation uses server calculation. Admin editing is limited to due date/note; payment status and arbitrary financial totals are not forged. |
| PAY-13 | Implemented | Invoice search, status and creation-date filters apply across fetched pages. |
| PAY-14 | Implemented | Admin payment and invoice filters/search use real records. |
| PAY-15 | Deferred | Configured service charge is displayed when returned; a separate commission line awaits the finalized model. |
| PAY-16 | Partial | Invoice totals/fees and wallet ledger amounts use backend data. Outstanding invoice calculations follow the backend's debit-ledger rule. New booking estimates remain explicitly estimates until a public fee/booking preview is available. |

## Disputes, refunds, payouts and support

Implementation: `components/operations/DisputesPage.tsx`, `SupportPage.tsx`, and explicit unavailable pages for unsupported financial workflows.

| ID | Status | Current behavior / remaining work |
| --- | --- | --- |
| FIN-01 | Implemented | Customer disputes load from the scoped backend list. |
| FIN-02 | Implemented | Booking details link to disputes; submission requires a real payment selected from the customer's owned invoice. |
| FIN-03 | Implemented | Admin navigation opens real dispute management. |
| FIN-04 | Partial | Admins can view disputes and record no-refund resolutions. Refund-linked resolution is unavailable while refund processing is disabled. |
| FIN-05 | Blocked | Refund RPC/service implementation is disabled. |
| FIN-06 | Blocked | Refund approval/rejection cannot be completed through the current backend. |
| FIN-07 | Blocked | Refund history/status is unavailable through the disabled implementation. |
| FIN-08 | Blocked | Withdrawal RPC/service implementation is disabled. |
| FIN-09 | Blocked | Admin withdrawal processing has the same dependency. |
| FIN-10 | Blocked | No saved payout-bank-account contract. |
| FIN-11 | Blocked | No active withdrawal execution/restriction workflow to enforce through the UI. |
| FIN-12 | Partial | General support has a dedicated page. A valid configured `NEXT_PUBLIC_SUPPORT_EMAIL` opens the user's email app. There is no fake “message submitted”; a processing endpoint or configured support inbox is still needed. |

## Subscriptions and fees

Implementation: `components/operations/SubscriptionsPage.tsx`, `FeesPage.tsx`, provider invoice aggregation and public catalogue featured labels.

| ID | Status | Current behavior / remaining work |
| --- | --- | --- |
| SUB-01 | Implemented | Provider subscriptions use `serviceProviderId`. Provider invoices combine own subscription invoices with invoices for all owned bookings. |
| SUB-02 | Partial | Confirmed deactivation PATCH sets `INACTIVE`. Refunds, renewal cancellation semantics and immediate listing-status synchronization need backend workflow support. |
| SUB-03 | Implemented | Fees display actual backend records. |
| SUB-04 | Implemented | Fees and subscription prices display NGN; invoices/wallets use their returned currency. |
| SUB-05 | Partial | Add/edit/delete/status actions are wired with errors and confirmations. Numeric amount/KYC-name validation bugs prevent reliable create/edit until backend validators are fixed. |
| SUB-06 | Blocked | Promotion purchase is not offered before backend payment/activation is complete. |
| SUB-07 | Partial | Catering catalogue cards display the real `isFeatured` flag, excluding expired promotions. Venue promotion display requires a corresponding backend field. No fake promoted ranking is applied. |

## Admin operations

Implementation: `components/operations/OperationsNav.tsx`, `ListingsPage.tsx`, `ListingEditor.tsx`, `GeographyPage.tsx`, `AdminUsers.tsx`, `Dashboard.tsx`, and `AdminSettings.tsx`.

| ID | Status | Current behavior / remaining work |
| --- | --- | --- |
| ADMIN-01 | Implemented | Admin Bookings route lists real bookings and opens details. |
| ADMIN-02 | Implemented | Sidebar Bookings link points to `/admin/bookings`. |
| ADMIN-03 | Implemented | Admin/provider listing creation/editing routes use actual listing DTOs and photo uploads. |
| ADMIN-04 | Deferred | No invented approval/rejection states; finalized moderation workflow is needed. Existing supported venue active/inactive status is editable. |
| ADMIN-05 | Implemented | Country/state removal uses soft-delete `POST /admin/{country,state}/:id`, never permanent `DELETE`. Removed records are excluded from active selections. |
| ADMIN-06 | Blocked | Country/state DTOs have no active-status field. |
| ADMIN-07 | Blocked | No city management endpoints. |
| ADMIN-08 | Implemented | Users/providers, payments, invoices and geography have working search. |
| ADMIN-09 | Blocked | No support-message processing endpoint. Dedicated support now explains contact availability instead of reporting fake delivery. |
| ADMIN-10 | Implemented | Dashboard uses real bookings and service-fee credits; monthly booking and receipt charts replace samples. |
| ADMIN-11 | Implemented | Explicit creation-date ranges apply to the real scoped records. |

## Provider operations

Implementation: shared operational dashboard, listing/availability editors, manual-booking preparation and account settings.

| ID | Status | Current behavior / remaining work |
| --- | --- | --- |
| PROV-01 | Implemented | Provider dashboard is scoped to the current provider. |
| PROV-02 | Implemented | Booking counts/trends use owned bookings; received booking earnings use the provider's actual `ESCROW_RELEASE` credits. These are receipts, not fabricated projected profit or held balances. |
| PROV-03 | Implemented | Manual customer selection uses only references from the provider's own bookings/quotes. The platform-wide customer query is disconnected. |
| PROV-04 | Partial | Authorized customer selection and quote ownership checks are present. Submission awaits readable fee configuration and a supported provider/manual booking contract. |
| PROV-05 | Implemented | Providers can add/edit future available slots on owned listings. Reserved/booked slots are not offered for editing; overlaps and invalid dates are rejected locally. Backend concurrency fixes still require BOOK-14 verification. |
| PROV-06 | Blocked | Saved payout-bank-account support is absent. |
| PROV-07 | Deferred | Submission awaits finalized KYC launch policy and backend support. |
| PROV-08 | Blocked | Admin verification page explains that real KYC data/review contracts are unavailable. |

## External customers

| ID | Status | Current behavior / remaining work |
| --- | --- | --- |
| GUEST-01 | Deferred | Product must finalize the external-customer model. |
| GUEST-02 | Deferred | No unapproved guest onboarding implemented. |
| GUEST-03 | Deferred | No external-customer booking/invoice identity invented. |
| GUEST-04 | Deferred | Guest payment links await the selected backend model. |
| GUEST-05 | Deferred | Access restrictions must follow that finalized model. |

## Notifications and reviews

| ID | Status | Current behavior / remaining work |
| --- | --- | --- |
| NOTIF-01 | Blocked | Notification centre route is present with an unavailable state; backend list/read RPC handlers are commented out. |
| NOTIF-02 | Implemented | Active header bell/navigation controls open `/notifications`. |
| NOTIF-03 | Blocked | No fabricated unread count; needs real list/unread support. |
| NOTIF-04 | Blocked | View/read mutations need active handlers. |
| NOTIF-05 | Implemented | Header uses the identity supplied by the authenticated login response. |
| REV-01 | Implemented | Fake listing reviews are removed. |
| REV-02 | Partial | Real aggregate listing ratings are displayed. Review retrieval needs enabled backend routes. |
| REV-03 | Blocked | No review submission without backend completed-booking eligibility. |
| REV-04 | Partial | Actual ratings and an honest unavailable/empty review state replace fabricated review content. Real loading/submission awaits the review API. |
| REV-05 | Implemented | Unverified homepage testimonials are removed. Genuine approved content can be added when supplied. |
| REV-06 | Deferred | Platform reviews await product/backend scope. |

## Navigation, failures and authentication

| ID | Status | Current behavior / remaining work |
| --- | --- | --- |
| UI-01 | Implemented | Active literal navigation links were checked against routes. Provider/admin menus now point to available pages; unsupported features show explicit availability states. Staff login lands on support instead of a missing `/staff` route. |
| UI-02 | Implemented | Add Event Center/Add Catering and admin listing edit/create actions open working forms. |
| UI-03 | Implemented | Branded root/global error boundaries and existing listing error boundaries have recovery actions. |
| UI-04 | Implemented | Branded not-found page links to real support/catalogues; missing public listing IDs return 404. |
| UI-05 | Implemented | Operational reads, auth checks, existing group Suspense and mutations show visible loading/disabled states. Public layout is not wrapped in a streaming boundary that would mask missing-listing HTTP 404. |
| UI-06 | Implemented | Network/CORS-like failures, timeouts, response parse errors, validation arrays and HTTP failures show useful errors. Success follows unwrapped successful mutations or verified invoice state. Older admin profile checks no longer clear all browser storage on a request error. Private API caches reset on account changes. |
| UI-07 | Partial | Invoice/wallet amounts use returned currencies; launch prices/fees use NGN. Multi-country pricing requires an approved backend currency model. |

Forgot-password uses a **reset link**, not an OTP entry workflow: the backend constructs `/resetpassword?resettoken=...&tokendata=...` in the email. The frontend says “Send Reset Link.” The template's “code” wording/expiry discrepancy is a backend issue left unchanged. Frontend errors do not fix the API's CORS configuration; they prevent a failed request from being shown as “email sent” or “invalid credentials.”

The individual `/users/:id` read route is admin-only. Login supplies a sanitized current-user snapshot for customer/provider headers and role navigation. Old sessions without that snapshot are asked to sign in again. Passwords, refresh tokens and unrelated user data are not copied into this profile snapshot. Backend authorization remains authoritative.

## Backend evidence inspected (read only)

- `backend/apps/apigateway/src/booking/booking.service.ts`, `backend/apps/booking/src/booking.service.ts`, `backend/libs/contracts/src/booking/`: filter forwarding, booking updates, fees and enums.
- `backend/apps/apigateway/src/payment/payment.controller.ts`, `backend/apps/payments/src/payments.controller.ts`: actual HTTP routes versus enabled RPC handlers.
- `backend/apps/payments/src/services/{invoice,wallet,subscription,fees,refund,withdrawal}.service.ts`: balances, invoices, subscription status and disabled financial processing.
- `backend/libs/contracts/src/payments/{create-payments,update-payments}.dto.ts`: supported fields and fee validators.
- `backend/apps/apigateway/src/users/users.controller.ts`: profile access and password reset flow.
- `backend/apps/notifications/src/notifications.controller.ts`: disabled notification read/list handlers.
- Listing schemas/controllers and geography DTOs: supported filters, `featureExpiringAt`, subscription fields, soft deletion and missing active/city contracts.

## Validation and deployment

- Regression tests exercise real RTK endpoints/component handlers with controlled responses: search/pagination, bookmark isolation, auth errors, payment retry, scoped operational lists, ownership, real debit-based balances and quote details.
- Production build includes TypeScript checking.
- HTTP smoke tests inspect initial catalogue/detail HTML, metadata, filtering beyond page one and missing-listing HTTP status.
- No real charge, cancellation, refund, withdrawal, email or production mutation was submitted by these checks. Authenticated visual QA and end-to-end payment/availability testing remain necessary against a working deployed backend.
- Configure the actual frontend `NEXT_PUBLIC_SITE_URL`; optionally configure a verified `NEXT_PUBLIC_SUPPORT_EMAIL`. The example file documents both. Real deployment values were not guessed or added to `.env`.
