import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSaasData } from '@/saas/AuthContext';
import { formatDate } from '@/lib/utils';

export function AuditLogPage() {
  const data = useSaasData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="text-sm text-slate-500 mt-1">Track sign-ins, plan changes, and user administration.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent events</CardTitle>
          <CardDescription>Stored locally with the mock SaaS state.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.auditLog.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-slate-100 px-4 py-3">
              <div className="font-medium text-sm">{entry.action}</div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>Actor: {entry.actorName}</span>
                {entry.target ? <span>Target: {entry.target}</span> : null}
                <span>{formatDate(entry.createdAt)}</span>
              </div>
            </div>
          ))}
          {data.auditLog.length === 0 ? (
            <p className="text-sm text-slate-500">No events yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
