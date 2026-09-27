'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { InkSwatches } from '@/components/ui/ink';
import { cn } from '@/lib/utils';
import { createCoupleAction, joinCoupleAction, signIn, signUp, uploadBookAction } from './actions';
import { MAX_EPUB_BYTES } from './epub-meta';
import { COLORS } from './palette';

export const inputClass =
  'h-11 w-full min-w-0 rounded-xl border bg-background px-4 text-base text-foreground outline-none placeholder:text-pencil focus-visible:border-ink focus-visible:outline-none';
const label = 'flex flex-col gap-1.5 text-sm text-muted-foreground';

function ErrorLine({ error }: { error?: string }) {
  return error ? (
    <p role="alert" className="text-sm text-danger">
      {error}
    </p>
  ) : null;
}

export function AuthForm({ next }: { next: string }) {
  const [tab, setTab] = useState<'in' | 'up'>('in');
  const [inState, inAction, inPending] = useActionState(signIn, undefined);
  const [upState, upAction, upPending] = useActionState(signUp, undefined);
  const signingUp = tab === 'up';
  return (
    <div className="flex w-full flex-col gap-5">
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-full bg-wash p-1">
        <Button role="tab" size="md" aria-selected={!signingUp} variant={signingUp ? 'quiet' : 'primary'} onClick={() => setTab('in')}>
          Sign in
        </Button>
        <Button role="tab" size="md" aria-selected={signingUp} variant={signingUp ? 'primary' : 'quiet'} onClick={() => setTab('up')}>
          Sign up
        </Button>
      </div>
      <form key={tab} action={signingUp ? upAction : inAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <label className={label}>
          Email
          <input className={inputClass} name="email" type="email" autoComplete="email" required />
        </label>
        <label className={label}>
          Password
          <input
            className={inputClass}
            name="password"
            type="password"
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            minLength={signingUp ? 6 : undefined}
            required
          />
        </label>
        <ErrorLine error={(signingUp ? upState : inState)?.error} />
        <Button type="submit" size="md" className="mt-1" disabled={inPending || upPending}>
          {signingUp ? 'Create account' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}

function ProfileFields({ exclude = [] }: { exclude?: string[] }) {
  const [color, setColor] = useState<string>(() => COLORS.find((c) => !exclude.includes(c)) ?? COLORS[0]);
  return (
    <>
      <label className={label}>
        Your name
        <input className={inputClass} name="name" maxLength={40} autoComplete="given-name" required />
      </label>
      <InkSwatches value={color} onChange={setColor} exclude={exclude} />
    </>
  );
}

export function CreateCoupleForm() {
  const [state, action, pending] = useActionState(createCoupleAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <ProfileFields />
      <ErrorLine error={state?.error} />
      <Button type="submit" size="md" disabled={pending}>
        Start our library
      </Button>
    </form>
  );
}

export function JoinForm({ code, partnerColors = [] }: { code: string; partnerColors?: string[] }) {
  const [state, action, pending] = useActionState(joinCoupleAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="code" value={code} />
      <ProfileFields exclude={partnerColors} />
      <ErrorLine error={state?.error} />
      <Button type="submit" size="md" disabled={pending}>
        Join
      </Button>
    </form>
  );
}

const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false;

/** "Add a book" picker; on desktop an EPUB dropped anywhere on the page uploads straight away. */
export function UploadForm({ className }: { className?: string }) {
  const [state, action, pending] = useActionState(uploadBookAction, undefined);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const tooBig = (file?.size ?? 0) > MAX_EPUB_BYTES;
  const error = tooBig ? 'That file is over 50 MB.' : state && 'error' in state ? state.error : undefined;

  useEffect(() => setFile(null), [state]);

  useEffect(() => {
    let depth = 0;
    const enter = (e: DragEvent) => hasFiles(e) && (depth++, setDragging(true));
    const leave = (e: DragEvent) => hasFiles(e) && --depth <= 0 && ((depth = 0), setDragging(false));
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault();
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const files = e.dataTransfer!.files;
      if (!files.length || !input.current) return;
      input.current.files = files;
      setFile(files[0]);
      if (files[0].size <= MAX_EPUB_BYTES) form.current?.requestSubmit();
    };
    const on = { dragenter: enter, dragleave: leave, dragover: over, drop } as const;
    for (const [k, f] of Object.entries(on)) window.addEventListener(k, f as EventListener);
    return () => {
      for (const [k, f] of Object.entries(on)) window.removeEventListener(k, f as EventListener);
    };
  }, []);

  return (
    <form ref={form} action={action} className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {file && !pending && (
          <span className="max-w-48 truncate text-sm text-muted-foreground" title={file.name}>
            {file.name}
          </span>
        )}
        {file && (
          <Button type="submit" size="md" disabled={pending || tooBig}>
            {pending ? 'Uploading…' : 'Upload'}
          </Button>
        )}
        <label
          className={cn(
            buttonVariants({ variant: file ? 'outline' : 'primary', size: 'md' }),
            'cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink',
            pending && 'hidden',
          )}
        >
          {file ? 'Choose another' : 'Add a book'}
          <input
            ref={input}
            name="file"
            type="file"
            accept=".epub,application/epub+zip"
            aria-label="EPUB file"
            className="sr-only"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      <ErrorLine error={error} />
      {!tooBig && !file && state && 'ok' in state && (
        <p role="status" className="text-sm text-muted-foreground">
          {state.ok}
        </p>
      )}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-paper/85 p-6 backdrop-blur-sm">
          <p className="rounded-sheet border-2 border-dashed border-ink/40 px-10 py-16 text-center font-serif text-2xl">Drop the EPUB to add it to your shelf</p>
        </div>
      )}
    </form>
  );
}

export function CopyInvite({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input className={cn(inputClass, 'rounded-full text-sm')} readOnly value={url} aria-label="Invite link" onFocus={(e) => e.target.select()} />
      <Button
        type="button"
        size="md"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
