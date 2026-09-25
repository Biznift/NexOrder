import { useRef, useState } from 'react';
import { Database, Download, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { resetSaasDemoData } from '@/saas/store';
import { useSaasData } from '@/saas/AuthContext';
import { downloadPlatformBackup, restorePlatformBackup } from '@/saas/backup';

export function SystemSettingsPage() {
  const data = useSaasData();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState<'download' | 'restore' | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleDownload = async () => {
    setBusy('download');
    setMessage(null);
    try {
      const payload = await downloadPlatformBackup();
      setMessage({
        type: 'ok',
        text: `Full SaaS backup downloaded (${payload.saas.users.length} users, ${payload.saas.plans.length} plans, ${payload.shop.counts?.orders ?? payload.shop.orders.length} orders).`,
      });
    } catch (err: any) {
      setMessage({ type: 'err', text: err.message || 'Backup failed' });
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const confirmed = window.confirm(
      'Restore FULL SaaS database? This replaces ALL users, plans, audit log, and shop data (orders/inventory/config). Continue?'
    );
    if (!confirmed) return;

    setBusy('restore');
    setMessage(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = await restorePlatformBackup(parsed);
      setMessage({
        type: 'ok',
        text: `Platform restored: ${result.users} users, ${result.plans} plans, ${result.shop.orders} orders, ${result.shop.inventory} products.`,
      });
      setTimeout(() => window.location.reload(), 1200);
    } catch (err: any) {
      setMessage({ type: 'err', text: err.message || 'Restore failed' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Super Admin only. Full SaaS database backup includes every account, plan, and shop data.
        </p>
      </div>

      <Card className="border-emerald-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-emerald-600" />
            Full SaaS database
          </CardTitle>
          <CardDescription>
            Download or restore the complete platform: all SaaS users, plans, audit log, plus orders,
            inventory, and config. Shop owners use Settings → Backup for their own account only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleDownload} disabled={!!busy} className="sm:flex-1">
              {busy === 'download' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download full SaaS backup
                </>
              )}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleRestore}
            />
            <Button
              variant="outline"
              className="sm:flex-1 border-amber-300 text-amber-900 hover:bg-amber-50"
              disabled={!!busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy === 'restore' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Restoring…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Restore full SaaS backup
                </>
              )}
            </Button>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
            Restore replaces the entire platform snapshot. Keep backup files secure — they can include
            customer orders and configuration.
          </div>

          {message ? (
            <div
              className={`rounded-xl border px-3 py-2.5 text-sm ${
                message.type === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              {message.text}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
            <CardDescription>JWT sessions against the Workers API.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <div className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5">
              <span>Auth mode</span>
              <Badge variant="default">JWT / server auth</Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5">
              <span>Token storage</span>
              <Badge variant="secondary">localStorage (Bearer)</Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5">
              <span>Password check</span>
              <Badge variant="secondary">Disabled for demos</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Demo data</CardTitle>
            <CardDescription>Reset seeded plans and accounts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-slate-600">
              <p>
                Users: <strong>{data.users.length}</strong>
              </p>
              <p>
                Plans: <strong>{data.plans.length}</strong>
              </p>
              <p>
                Audit events: <strong>{data.auditLog.length}</strong>
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                if (confirm('Reset SaaS demo data to seed defaults?')) resetSaasDemoData();
              }}
            >
              Reset demo data
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
