# Agenda calendar

> **Scope:** the big-calendar port, event form, audiences, Google events, ICS subscribe. Schema: [m4-calendar.md](../../database-architecture/m4-calendar.md) · Google sync: [google-integration.md](../../backend-architecture/google-integration.md).
> Index: [frontend-architecture/](../README.md) · Gateway: [README_AI_AGENT.md](../../../README_AI_AGENT.md)

1. Copy only `src/calendar/` from `lramos33/big-calendar` into `src/features/calendar/big-calendar/`. **Do not copy its `src/components/ui/`**: those are Radix-based and would fight the template's Base UI primitives.
2. Point its imports at the template's `@/components/ui/*`. Add any missing primitive with the shadcn CLI (the template's `components.json` already targets Base UI).
3. Replace `asChild` with `render`, e.g. `<DialogTrigger render={<Button variant="outline" />}>New event</DialogTrigger>`.
4. Remove big-calendar's react-dnd drag-to-reschedule in v1 (edit times in the event dialog). If dragging is wanted later, rebuild it with dnd-kit, which the template already ships. One drag-and-drop library, not two.
5. Feed its `CalendarProvider` from `useEvents()`. Map DB rows to big-calendar's event type; expand `rrule` with the `rrule` package for the visible range.
6. Store UTC, display `Asia/Jakarta` (use `TZDate` from `@date-fns/tz`).
7. Event form: title, time range, all-day, location, audience picker (users, roles **and groups**), optional "also send role mail" (PSI-043). Audience members get an `event.invited` notification automatically.
8. **Google:** events with `source = 'google'` get a "Google" badge, open read-only and link to Google Calendar. The form lists the linked Google calendars the event will be pushed to ([documents.md](documents.md)).
9. "Subscribe" button copies the user's ICS feed URL (`/api/calendar/feed/<token>`).

## Google Calendar in the agenda

- Google-pulled events show a small "Google" badge, open read-only, and offer "Open in Google Calendar" (`html_link`).
- The event form shows which linked Google calendars the event will appear in (derived from the chosen roles/groups).
