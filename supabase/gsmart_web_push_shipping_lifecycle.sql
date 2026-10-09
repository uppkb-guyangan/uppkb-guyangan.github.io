-- G-Smart production PWA push: safely extend lifecycle event type whitelist.
-- No ETLE table, delivery ledger, cursor, row, policy, or token is modified.
-- Existing event types remain valid.
alter table public.gsmart_web_push_events
  drop constraint if exists gsmart_web_push_events_event_type_check,
  add constraint gsmart_web_push_events_event_type_check
  check (event_type in (
    'blanko',
    'dispute',
    'shipping_processing',
    'shipping_printed',
    'shipping_delivered',
    'shipping_failed',
    'shipping_returned'
  ));
