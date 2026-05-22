import { cn } from '@/lib/utils';

type Variant = 'taslak' | 'onaylandi' | 'iptal' | 'hata' | 'default';

const variantClasses: Record<Variant, string> = {
  taslak: 'bg-amber-100 text-amber-800 border-amber-200',
  onaylandi: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  iptal: 'bg-gray-100 text-gray-600 border-gray-200',
  hata: 'bg-red-100 text-red-700 border-red-200',
  default: 'bg-blue-100 text-blue-800 border-blue-200',
};

const variantLabels: Record<string, string> = {
  taslak: 'Taslak',
  onaylandi: 'Onaylandı',
  iptal: 'İptal',
  hata: 'Hata',
};

interface BadgeProps {
  status: string;
  className?: string;
}

export function Badge({ status, className }: BadgeProps) {
  const variant = (status as Variant) in variantClasses ? (status as Variant) : 'default';
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        variantClasses[variant],
        className,
      )}
    >
      {variantLabels[status] ?? status}
    </span>
  );
}
