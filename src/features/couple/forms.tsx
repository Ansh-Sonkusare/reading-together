'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { createCoupleAction, joinCoupleAction, signIn, signUp, uploadBookAction } from './actions';
import { MAX_EPUB_BYTES } from './epub-meta';
import { COLORS } from './palette';

const input = 'w-full rounded-md border px-3 py-2';

function ErrorLine({ error }: { error?: string }) {
  return error ? (
    <p role="alert" className="text-sm text-red-600">
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
    <div className="flex w-full max-w-sm flex-col gap-4">
      <div role="tablist" className="flex gap-2">
        <Button role="tab" aria-selected={!signingUp} variant={signingUp ? 'outline' : 'default'} onClick={() => setTab('in')}>
          Sign in
        </Button>
        <Button role="tab" aria-selected={signingUp} variant={signingUp ? 'default' : 'outline'} onClick={() => setTab('up')}>
          Sign up
        </Button>
      </div>
      <form key={tab} action={signingUp ? upAction : inAction} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1">
          Email
          <input className={input} name="email" type="email" autoComplete="email" required />
        </label>
        <label className="flex flex-col gap-1">
          Password
          <input
            className={input}
            name="password"
            type="password"
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            minLength={signingUp ? 6 : undefined}
            required
          />
        </label>
        <ErrorLine error={(signingUp ? upState : inState)?.error} />
        <Button type="submit" disabled={inPending || upPending}>
          {signingUp ? 'Create account' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}

function ProfileFields() {
  return (
    <>
      <label className="flex flex-col gap-1">
        Your name
        <input className={input} name="name" maxLength={40} required />
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend>Your colour</legend>
        <div className="flex gap-2">
          {COLORS.map((c, i) => (
            <label key={c} className="cursor-pointer">
              <input type="radio" name="color" value={c} defaultChecked={i === 0} className="peer sr-only" aria-label={c} />
              <span className="block size-8 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-black peer-focus-visible:ring-2" style={{ background: c }} />
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

export function CreateCoupleForm() {
  const [state, action, pending] = useActionState(createCoupleAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <ProfileFields />
      <ErrorLine error={state?.error} />
      <Button type="submit" disabled={pending}>
        Start our library
      </Button>
    </form>
  );
}

export function JoinForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState(joinCoupleAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="code" value={code} />
      <ProfileFields />
      <ErrorLine error={state?.error} />
      <Button type="submit" disabled={pending}>
        Join
      </Button>
    </form>
  );
}

export function UploadForm() {
  const [state, action, pending] = useActionState(uploadBookAction, undefined);
  const [tooBig, setTooBig] = useState(false);
  const error = tooBig ? 'That file is over 50 MB.' : state && 'error' in state ? state.error : undefined;
  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          name="file"
          type="file"
          accept=".epub,application/epub+zip"
          aria-label="EPUB file"
          required
          onChange={(e) => setTooBig((e.target.files?.[0]?.size ?? 0) > MAX_EPUB_BYTES)}
        />
        <Button type="submit" disabled={pending || tooBig}>
          {pending ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
      <ErrorLine error={error} />
      {!tooBig && state && 'ok' in state && (
        <p role="status" className="text-sm text-green-700">
          {state.ok}
        </p>
      )}
    </form>
  );
}

export function CopyInvite({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input className={input} readOnly value={url} aria-label="Invite link" onFocus={(e) => e.target.select()} />
      <Button
        type="button"
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
