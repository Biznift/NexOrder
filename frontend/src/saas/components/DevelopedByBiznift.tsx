import { cn } from '@/lib/utils';

const BIZNIFT_URL = 'https://biznift.com';

export function DevelopedByBiznift({
  className,
  align = 'center',
}: {
  className?: string;
  align?: 'center' | 'left' | 'right';
}) {
  return (
    <p
      className={cn(
        'text-xs text-slate-500',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        align === 'right' && 'text-right',
        className
      )}
    >
      Developed by{' '}
      <a
        href={BIZNIFT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-emerald-700 hover:text-emerald-600 underline-offset-2 hover:underline"
      >
        Biznift.com
      </a>
    </p>
  );
}
