import { INKS, inkName } from '@/features/couple/palette';
import { cn } from '@/lib/utils';

export type InkDotProps = { color: string; name?: string; className?: string };

/** A partner's ink as a dot. With `name` it is announced (role img); without, it is decorative. */
export function InkDot({ color, name, className }: InkDotProps) {
  return (
    <span
      role={name ? 'img' : undefined}
      aria-label={name}
      aria-hidden={name ? undefined : true}
      className={cn('inline-block size-3 shrink-0 rounded-full', className)}
      style={{ background: color }}
    />
  );
}

export type AvatarProps = { name: string; color: string; size?: 'sm' | 'md'; className?: string };

/** The partner's initial in their ink. */
export function Avatar({ name, color, size = 'md', className }: AvatarProps) {
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-sans font-semibold text-white',
        size === 'sm' ? 'size-6 text-xs' : 'size-8 text-sm',
        className,
      )}
      style={{ background: color }}
    >
      <span aria-hidden>{name.trim().charAt(0).toUpperCase() || '?'}</span>
    </span>
  );
}

export type InkSwatchesProps = {
  value: string;
  onChange: (color: string) => void;
  /** Inks not offered, e.g. the partner's. */
  exclude?: string[];
  /** Form field name for the radios. */
  name?: string;
  label?: string;
  className?: string;
};

/** Radio group of ink dots. Native radios, so arrow keys move between inks and it submits with a form. */
export function InkSwatches({ value, onChange, exclude = [], name = 'color', label = 'Your ink', className }: InkSwatchesProps) {
  const skip = exclude.map((c) => c.toLowerCase());
  return (
    <fieldset className={cn('flex flex-col gap-2', className)}>
      <legend className="mb-2 text-sm text-muted-foreground">
        {label}: <span className="text-foreground">{inkName(value)}</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {INKS.filter((i) => !skip.includes(i.color)).map((i) => (
          <label key={i.color} className="grid size-11 cursor-pointer place-items-center rounded-full">
            <input
              type="radio"
              name={name}
              value={i.color}
              checked={value === i.color}
              onChange={() => onChange(i.color)}
              aria-label={i.name}
              className="peer sr-only"
            />
            <span
              className="size-8 rounded-full ring-offset-2 ring-offset-background transition-shadow peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-dashed peer-focus-visible:outline-pencil"
              style={{ background: i.color }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
