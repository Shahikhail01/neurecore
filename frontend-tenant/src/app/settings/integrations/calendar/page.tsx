'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';

import { PageShell, PageHero, GlassPanel } from '@neurecore/ui-visual';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import {
  integrationsService,
  type CalendarEvent,
  type CreateEventInput,
} from '@/services/integrations.service';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const DEFAULT_RANGE_DAYS = 14;

interface CalendarOption {
  id: string;
  summary: string;
  primary: boolean;
}

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
        </div>
      }
    >
      <CalendarContent />
    </Suspense>
  );
}

function CalendarContent() {
  useTenantAuth();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  const [connected, setConnected] = useState<boolean | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<CalendarOption[]>([]);
  const [calendarId, setCalendarId] = useState<string>('primary');
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const timeMin = useMemo(() => new Date().toISOString(), []);
  const timeMax = useMemo(
    () => new Date(Date.now() + DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    [],
  );

  const fetchEvents = useCallback(async () => {
    try {
      setError(null);
      const status = await integrationsService.getGoogleStatus();
      setConnected(status.connected);
      if (!status.connected) {
        setEvents([]);
        return;
      }
      const [list, cals] = await Promise.all([
        integrationsService.getCalendarEvents({
          calendarId: calendarId !== 'primary' ? calendarId : undefined,
          maxResults: 50,
          timeMin,
          timeMax,
          q: activeQuery.trim() || undefined,
        }),
        integrationsService.getCalendarList().catch(() => []),
      ]);
      setEvents(list);
      setCalendars(cals);
      if (calendarId === 'primary') {
        const primary = cals.find((c) => c.primary);
        if (primary) setCalendarId(primary.id);
        else if (cals.length > 0) setCalendarId(cals[0].id);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load calendar events.');
    } finally {
      setLoading(false);
    }
  }, [calendarId, activeQuery, timeMin, timeMax]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const grouped = useMemo(() => groupByDay(events), [events]);

  return (
    <PageShell variant="default">
      <PageHero
        title="Google Calendar"
        subtitle="Browse upcoming events, schedule meetings, and manage attendees."
      />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/settings/integrations"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" /> Integrations
          </Link>
          <h1 className="text-xl font-semibold mt-1 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[color:var(--state-info)]" />
            Google Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse upcoming events, schedule meetings, and manage attendees.
          </p>
        </div>
        {connected && (
          <div className="flex items-center gap-2">
            <select
              aria-label="Select calendar"
              className="bg-background border rounded-md px-2 py-1 text-sm"
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
            >
              {calendars.length === 0 ? (
                <option value="primary">Primary</option>
              ) : (
                calendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.summary}
                    {c.primary ? ' (primary)' : ''}
                  </option>
                ))
              )}
            </select>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" /> New event
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {connected === false && (
        <GlassPanel variant="tile" padding="md" interactive className="p-6 text-center space-y-3">
          <CalendarIcon className="w-10 h-10 mx-auto text-[color:var(--state-info)]" />
          <h2 className="text-base font-medium">Google Workspace not connected</h2>
          <p className="text-sm text-muted-foreground">
            Connect Google to view and schedule calendar events.
          </p>
          <div className="flex justify-center gap-2">
            <Link href="/settings/integrations">
              <Button size="sm">Connect Google</Button>
            </Link>
          </div>
        </GlassPanel>
      )}

      {connected && (
        <>
          <GlassPanel variant="tile" padding="sm" className="p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setActiveQuery(searchInput.trim());
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search events by title, description, or attendee…"
                  className="pl-9"
                />
              </div>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
              </Button>
              {activeQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchInput('');
                    setActiveQuery('');
                  }}
                >
                  Clear
                </Button>
              )}
            </form>
          </GlassPanel>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <GlassPanel variant="tile" padding="md" className="p-6 text-center text-sm text-muted-foreground">
              {activeQuery
                ? 'No events matched your search.'
                : 'No upcoming events in this calendar. Click New event to schedule one.'}
            </GlassPanel>
          ) : (
            <div className="space-y-4">
              {grouped.map(({ dayKey, label, items }) => (
                <section key={dayKey} className="space-y-2">
                  <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                    {label}
                  </h3>
                  {items.map((event) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      onDeleted={() => {
                        setEvents((prev) => prev.filter((e) => e.id !== event.id));
                      }}
                      onError={setError}
                      calendarId={calendarId}
                    />
                  ))}
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {showCreate && (
        <CreateEventDialog
          calendarId={calendarId}
          defaultDate={new Date().toISOString().slice(0, 10)}
          onClose={() => setShowCreate(false)}
          onCreated={(ev) => {
            setShowCreate(false);
            setEvents((prev) => [...prev, ev].sort(byStart));
            void fetchEvents();
          }}
          onError={setError}
        />
      )}
    </PageShell>
  );
}

function EventRow({
  event,
  calendarId,
  onDeleted,
  onError,
}: {
  event: CalendarEvent;
  calendarId: string;
  onDeleted: () => void;
  onError: (err: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    if (!confirm(`Delete "${event.summary}"?`)) return;
    try {
      setDeleting(true);
      await integrationsService.deleteCalendarEvent(event.id, calendarId !== 'primary' ? calendarId : undefined);
      onDeleted();
    } catch (err) {
      console.error(err);
      onError('Failed to delete event.');
    } finally {
      setDeleting(false);
    }
  };

  const start = new Date(event.start);
  const end = new Date(event.end);
  const timeFmt = (d: Date) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      <GlassPanel variant="tile" padding="md" interactive className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-1.5 h-12 rounded-full bg-[color:var(--state-info)]/60 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{event.summary}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeFmt(start)} – {timeFmt(end)}
                </span>
                {event.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {event.location}
                  </span>
                )}
                {event.attendees.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {event.attendees.length}
                  </span>
                )}
                <Badge variant="outline" className="text-xs">
                  {event.status}
                </Badge>
              </div>
              {event.description && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {event.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {event.htmlLink && (
              <a href={event.htmlLink} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </a>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </GlassPanel>
    </motion.div>
  );
}

function CreateEventDialog({
  calendarId,
  defaultDate,
  onClose,
  onCreated,
  onError,
}: {
  calendarId: string;
  defaultDate: string;
  onClose: () => void;
  onCreated: (event: CalendarEvent) => void;
  onError: (err: string) => void;
}) {
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [location, setLocation] = useState('');
  const [attendeesText, setAttendeesText] = useState('');
  const [timeZone, setTimeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    try {
      setBusy(true);
      setError(null);
      const start = new Date(`${date}T${startTime}:00`);
      const end = new Date(`${date}T${endTime}:00`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error('Invalid date or time.');
      }
      if (end <= start) {
        throw new Error('End must be after start.');
      }
      const attendees = attendeesText
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter((s) => s.includes('@'));
      const input: CreateEventInput = {
        summary: summary.trim(),
        description: description.trim() || undefined,
        start: start.toISOString(),
        end: end.toISOString(),
        timeZone,
        location: location.trim() || undefined,
        attendees: attendees.length > 0 ? attendees : undefined,
      };
      const created = await integrationsService.createCalendarEvent(
        input,
        calendarId !== 'primary' ? calendarId : undefined,
      );
      onCreated(created);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to create event.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New event</DialogTitle>
          <DialogDescription>
            Schedules on the selected calendar and invites any attendees you list.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="event-summary">Title</Label>
            <Input
              id="event-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="mt-1"
              placeholder="Weekly sync with engineering"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <Label htmlFor="event-date">Date</Label>
              <Input
                id="event-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="col-span-1">
              <Label htmlFor="event-start">Start</Label>
              <Input
                id="event-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="col-span-1">
              <Label htmlFor="event-end">End</Label>
              <Input
                id="event-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="event-tz">Timezone</Label>
            <Input
              id="event-tz"
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="event-location">Location</Label>
            <Input
              id="event-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="mt-1"
              placeholder="Conference room A or URL"
            />
          </div>
          <div>
            <Label htmlFor="event-attendees">Attendees (comma or space separated)</Label>
            <Textarea
              id="event-attendees"
              value={attendeesText}
              onChange={(e) => setAttendeesText(e.target.value)}
              className="mt-1 font-mono text-xs"
              rows={2}
              placeholder="alice@example.com, bob@example.com"
            />
          </div>
          <div>
            <Label htmlFor="event-description">Description</Label>
            <Textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={busy || !summary.trim()}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function byStart(a: CalendarEvent, b: CalendarEvent): number {
  return new Date(a.start).getTime() - new Date(b.start).getTime();
}

function groupByDay(events: CalendarEvent[]): { dayKey: string; label: string; items: CalendarEvent[] }[] {
  const sorted = [...events].sort(byStart);
  const buckets = new Map<string, CalendarEvent[]>();
  for (const ev of sorted) {
    const d = new Date(ev.start);
    const key = d.toISOString().slice(0, 10);
    const bucket = buckets.get(key) ?? [];
    bucket.push(ev);
    buckets.set(key, bucket);
  }
  return Array.from(buckets.entries()).map(([dayKey, items]) => {
    const sample = new Date(items[0].start);
    const label = sample.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: sample.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
    return { dayKey, label, items };
  });
}
