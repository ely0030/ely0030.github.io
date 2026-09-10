# Notifications API contract — pinned 2026-09-10 01:44

Base: `a52f8d4e4358ab347a840d709c9912255164b1ae`, `/home/chris/filmmaand-integration`. Timing owner Gasket independently owns timing resolver, planning timing/manual action/round transfer and Beheer/Agenda. Do not edit those domains. Captain serializes integration.

## Account-only HTTP contract
All endpoints under `/filmmaand/api/notifications`, authenticated onboarded session; no anonymous public plan additions. Existing generation/CSRF rules apply to writes. Response Cache-Control no-store. Errors canonical `{error:{code,message}}`; 401/410 locks UI, no login mint.

- GET `?cursor=OPAQUE&limit=20` returns `{items, unreadCount, nextCursor, serverTime, preferences:{importantActivityEmail:true|false}}`. Max limit50; descending latest activity order. Missing state returns honest empty data without initialization writes.
- Each item `{id,type,text,href,createdAt,updatedAt,readAt:null|ISO,actor:null|{name,avatarId},count}`. IDs are opaque notification IDs only. Relative time uses original updatedAt with exact accessible timestamp. URLs are allowlisted site-relative /filmmaand/... links, never arbitrary HTML/URLs. No private participant IDs/emails.
- POST `/read` body `{items:[{id,updatedAt}]}` marks only those observed item versions for current account. Max100. Repeated identical ACK idempotent; if group updated since preview it remains unread. UI mark-all submits all visible/unread fetched versions; to truly mark all use `{allThrough:serverTime}` server fence, never future timestamp. Return `{unreadCount}`. Do not accept recipient/account selectors.
- PUT `/preferences` body `{importantActivityEmail:boolean}` returns `{importantActivityEmail}`. Account-only durable setting used by important activity mail recipient policy. Date notification semantics remain existing policy unless explicitly shared.

## Commit/event boundary
Backend owner Glacier: NEW private account notification module, focused tests, named API auth routes + successful mutation before/after hook; named handler/scheduled hook. No scoring/date lifecycle rewrite. Use actual canonical before/after projections and authenticated actor context, not client results. Failed writes/receipt replay unchanged state emit none. On first mutation baseline from BEFORE state captures the new mutation without historical backfill; scheduler initialization emits nothing. Anonymous public reads must not mutate notification baseline/history. Existing scheduler only; no new timer/store. Account history bounded90days/100, deterministic grouping and dedupe. Self-exclusions and canonical suggester mapping required. Group same-film likes and rapid related leader changes without repeated stale toasts; preserve latest truthful tie states.

All six activity classes in BRIEF.md required. New-round and concluded notices additionally exposed as committed mail-intent contract for Gecko, reusing same outbox/recipient policy and coalescing result/confirmation for same transition. No provider call before CAS. Glacier and Gecko coordinate this mail intent shape directly before implementation; Gecko follows current one-test/operator/timing work first.

## Bell UI owner Grid
NEW `public/filmmaand/site/notifications.js` + `.css`; narrow loader registration in existing shared shell entry only after inspecting actual loader. No profile/auth handler edits. Existing signed-in avatar anchors bell; observe existing session events, clear account-specific DOM on logout/change. Load on entry/focus >=30s throttle, no interval/push. One arrival toast per account/tab arrival window, suppress under login/tutorial/dialog; genuine unread only, 'Sinds je laatste bezoek', original timestamps. No fake live feed. Panel supports empty/error/loading, pagination, individual/all read, email preference. Safe textContent, keyboard focus/Escape/outside, mobile bounded.

## Handoffs and verification
Each owner writes `docs/notifications/NAME.md` with exact base/files/commit/patch/evidence/limits. Synthetic isolated work only. Backend focused recipient isolation/commit replay/grouping/ACK race tests. UI one affected desktop/mobile interaction check. Captain one integrated actual two-account suggestion/like/read persistence + voting outcome/history/captured-mail journey and live asset verification. No extra real sends or production events. No prototype promotion.
