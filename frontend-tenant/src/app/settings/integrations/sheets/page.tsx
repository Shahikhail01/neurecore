'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  Plus,
  Search,
  Table,
  Trash2,
  Upload,
} from 'lucide-react';

import { PageShell, PageHero, GlassPanel } from '@neurecore/ui-visual';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import {
  integrationsService,
  type DriveFile,
  type SpreadsheetMeta,
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

type View = 'list' | 'detail';

interface ListItem {
  spreadsheetId: string;
  title: string;
  webViewLink?: string;
  sheetTitles: string[];
  modifiedTime: string;
  source: 'search';
}

export default function SheetsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
        </div>
      }
    >
      <SheetsContent />
    </Suspense>
  );
}

function SheetsContent() {
  useTenantAuth();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  const [connected, setConnected] = useState<boolean | null>(null);
  const [view, setView] = useState<View>('list');
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchSheets = useCallback(async (query: string): Promise<ListItem[]> => {
    if (!query.trim()) {
      try {
        const files = await integrationsService.searchDrive('', {
          mimeType: 'application/vnd.google-apps.spreadsheet',
          mode: 'name',
          pageSize: 25,
        });
        return filesToListItems(files);
      } catch {
        return [];
      }
    }
    const files = await integrationsService.searchDrive(query, {
      mimeType: 'application/vnd.google-apps.spreadsheet',
      mode: 'name',
      pageSize: 25,
    });
    return filesToListItems(files);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const status = await integrationsService.getGoogleStatus();
      setConnected(status.connected);
      if (!status.connected) {
        setItems([]);
        return;
      }
      const results = await fetchSheets(activeQuery);
      setItems(results);
    } catch (err) {
      console.error(err);
      setError('Failed to load Google Sheets list.');
    } finally {
      setLoading(false);
    }
  }, [activeQuery, fetchSheets]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <PageShell variant="default">
      <PageHero
        title="Google Sheets"
        subtitle="Create, view, and edit spreadsheets connected to your tenant."
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
            <FileSpreadsheet className="w-5 h-5 text-[color:var(--state-success)]" />
            Google Sheets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create, view, and edit spreadsheets connected to your tenant.
          </p>
        </div>
        {connected && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" /> New spreadsheet
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
          <FileSpreadsheet className="w-10 h-10 mx-auto text-[color:var(--state-success)]" />
          <h2 className="text-base font-medium">Google Workspace not connected</h2>
          <p className="text-sm text-muted-foreground">
            Connect Google to create and manage spreadsheets for your tenant.
          </p>
          <div className="flex justify-center gap-2">
            <Link href="/settings/integrations">
              <Button size="sm">Connect Google</Button>
            </Link>
          </div>
        </GlassPanel>
      )}

      {connected && view === 'list' && (
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
                  placeholder="Search spreadsheets by filename…"
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
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <GlassPanel variant="tile" padding="md" className="p-6 text-center text-sm text-muted-foreground">
              {activeQuery
                ? 'No spreadsheets matched your search.'
                : 'No spreadsheets found. Create one to get started.'}
            </GlassPanel>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <SpreadsheetRow
                  key={item.spreadsheetId}
                  item={item}
                  onOpen={() => {
                    setView('detail');
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {connected && view === 'detail' && activeQuery && (
        <SpreadSheetDetail
          spreadsheetId={items[0]?.spreadsheetId ?? ''}
          fallbackTitle={items[0]?.title ?? ''}
          onBack={() => setView('list')}
          onError={setError}
        />
      )}

      {showCreate && (
        <CreateSpreadsheetDialog
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            setActiveQuery('');
            setSearchInput('');
            void refresh();
            if (id) {
              setItems([
                {
                  spreadsheetId: id,
                  title: 'Untitled spreadsheet',
                  sheetTitles: [],
                  modifiedTime: new Date().toISOString(),
                  source: 'search',
                },
              ]);
              setView('detail');
            }
          }}
        />
      )}
    </PageShell>
  );
}

function filesToListItems(files: DriveFile[]): ListItem[] {
  return files.map((f) => ({
    spreadsheetId: f.id,
    title: f.name,
    webViewLink: f.webViewLink,
    sheetTitles: [],
    modifiedTime: f.modifiedTime ?? new Date().toISOString(),
    source: 'search',
  }));
}

function SpreadsheetRow({ item, onOpen }: { item: ListItem; onOpen: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      <GlassPanel variant="tile" padding="md" interactive className="p-4 flex items-center justify-between gap-4 hover:border-[color:var(--state-success)]/30 transition cursor-pointer" onClick={onOpen}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-[color:var(--state-success)]/10 flex items-center justify-center flex-shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-[color:var(--state-success)]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{item.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {new Date(item.modifiedTime).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {item.webViewLink && (
            <a href={item.webViewLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm">
                <ExternalLink className="w-4 h-4" />
              </Button>
            </a>
          )}
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
            Open
          </Button>
        </div>
      </GlassPanel>
    </motion.div>
  );
}

function SpreadSheetDetail({
  spreadsheetId,
  fallbackTitle,
  onBack,
  onError,
}: {
  spreadsheetId: string;
  fallbackTitle: string;
  onBack: () => void;
  onError: (err: string) => void;
}) {
  const [meta, setMeta] = useState<SpreadsheetMeta | null>(null);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [rangeText, setRangeText] = useState('A1:D10');
  const [values, setValues] = useState<string[][]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>('');
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingRange, setLoadingRange] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingMeta(true);
        const m = await integrationsService.getSpreadsheetMetadata(spreadsheetId);
        setMeta(m);
        setActiveSheet(m.sheets[0]?.title ?? null);
      } catch (err) {
        console.error(err);
        onError('Failed to load spreadsheet metadata. Check that the spreadsheet is shared with your connected Google account.');
      } finally {
        setLoadingMeta(false);
      }
    };
    if (spreadsheetId) load();
  }, [spreadsheetId, onError]);

  const a1Range = useMemo(() => {
    if (!activeSheet) return rangeText;
    return rangeText.includes('!') ? rangeText : `${activeSheet}!${rangeText}`;
  }, [activeSheet, rangeText]);

  const loadRange = useCallback(async () => {
    if (!spreadsheetId || !a1Range) return;
    try {
      setLoadingRange(true);
      const data = await integrationsService.readSheetRange(spreadsheetId, a1Range);
      setValues(data.values);
    } catch (err) {
      console.error(err);
      onError('Failed to read range.');
    } finally {
      setLoadingRange(false);
    }
  }, [spreadsheetId, a1Range, onError]);

  useEffect(() => {
    loadRange();
  }, [loadRange]);

  const beginEdit = () => {
    setEditing(true);
    setDraft(values.map((row) => row.join('\t')).join('\n'));
  };

  const saveEdit = async () => {
    if (!spreadsheetId || !a1Range) return;
    try {
      const parsed = parseTabGrid(draft);
      const res = await integrationsService.writeSheetRange(spreadsheetId, a1Range, parsed);
      setEditing(false);
      await loadRange();
      onError(`Updated ${res.updatedCells} cells in ${res.updatedRange}.`);
    } catch (err) {
      console.error(err);
      onError('Failed to write range.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <h2 className="text-base font-semibold truncate">
            {meta?.title ?? fallbackTitle}
          </h2>
          {meta?.webViewLink && (
            <a href={meta.webViewLink} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm">
                <ExternalLink className="w-4 h-4" />
              </Button>
            </a>
          )}
        </div>
      </div>

      {loadingMeta ? (
        <Skeleton className="h-24 w-full" />
      ) : meta ? (
        <GlassPanel variant="tile" padding="sm" className="p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-xs">Sheet</Label>
            <select
              aria-label="Select sheet"
              className="bg-background border rounded-md px-2 py-1 text-sm"
              value={activeSheet ?? ''}
              onChange={(e) => setActiveSheet(e.target.value)}
            >
              {meta.sheets.map((s) => (
                <option key={s.sheetId} value={s.title}>
                  {s.title}
                </option>
              ))}
            </select>
            <Label className="text-xs ml-2">Range</Label>
            <Input
              value={rangeText}
              onChange={(e) => setRangeText(e.target.value)}
              className="w-32"
            />
            <Button variant="outline" size="sm" onClick={loadRange}>
              Reload
            </Button>
            {!editing ? (
              <Button size="sm" onClick={beginEdit}>
                Edit
              </Button>
            ) : (
              <>
                <Button size="sm" onClick={saveEdit}>
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </GlassPanel>
      ) : null}

      {!editing ? (
        loadingRange ? (
          <Skeleton className="h-40 w-full" />
        ) : values.length === 0 ? (
          <GlassPanel variant="tile" padding="md" className="p-6 text-center text-sm text-muted-foreground">
            Empty range — try a wider range or switch sheet.
          </GlassPanel>
        ) : (
          <GlassPanel variant="tile" padding="none" className="p-0 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <tbody>
                {values.map((row, ri) => (
                  <tr key={ri} className="border-b last:border-b-0">
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="px-2 py-1.5 border-r last:border-r-0 font-mono whitespace-pre"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassPanel>
        )
      ) : (
        <GlassPanel variant="tile" padding="sm" className="p-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.max(values.length, 8)}
            className="font-mono text-xs"
            placeholder={'Row 1\tCell B\nRow 2\tCell B'}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Tab-separated rows; one row per line. Targets <code>{a1Range}</code>.
          </p>
        </GlassPanel>
      )}
    </div>
  );
}

function parseTabGrid(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split('\t'))
    .filter((row) => row.length > 0 && !(row.length === 1 && row[0] === ''));
}

function CreateSpreadsheetDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (spreadsheetId: string) => void;
}) {
  const [title, setTitle] = useState('Untitled spreadsheet');
  const [firstSheet, setFirstSheet] = useState('Sheet1');
  const [importing, setImporting] = useState(false);
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    try {
      setBusy(true);
      setError(null);
      const meta = await integrationsService.createSpreadsheet({
        title: title.trim() || 'Untitled spreadsheet',
        sheets: firstSheet.trim() ? [{ title: firstSheet.trim() }] : undefined,
      });
      if (importing && csv.trim()) {
        const rows = parseCsv(csv);
        if (rows.length > 0) {
          await integrationsService.writeSheetRange(meta.spreadsheetId, `${meta.sheets[0]?.title ?? 'Sheet1'}`, rows);
        }
      }
      onCreated(meta.spreadsheetId);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to create spreadsheet.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New spreadsheet</DialogTitle>
          <DialogDescription>
            Create a blank spreadsheet or seed it with CSV data.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="sheet-title">Title</Label>
            <Input
              id="sheet-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="first-sheet">First sheet name</Label>
            <Input
              id="first-sheet"
              value={firstSheet}
              onChange={(e) => setFirstSheet(e.target.value)}
              className="mt-1"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={importing}
              onChange={(e) => setImporting(e.target.checked)}
              className="rounded border-input"
            />
            <span>Import CSV data</span>
          </label>
          {importing && (
            <div>
              <Label htmlFor="csv">CSV</Label>
              <Textarea
                id="csv"
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                className="mt-1 font-mono text-xs"
                rows={5}
                placeholder={`name,role\nAda,CTO\nLinus,Maintainer`}
              />
            </div>
          )}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < input.length; i += 1) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      field = '';
      if (!(row.length === 1 && row[0] === '')) rows.push(row);
      row = [];
    } else if (c === '\r') {
      // ignore
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
  }
  return rows;
}
