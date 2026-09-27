'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import type { Member } from '@/features/couple/couple';
import { createBrowserClient } from '@/lib/supabase';
import type { Enums, Tables } from '@/lib/types';
import { GUESS_OPTIONS, emojiOf, guessKey, parseGuess, revealGuess, type Guess, type GuessReaction } from './discussion';
import { questionsFor } from './questions';

type Answer = Tables<'answer'>;
type Submit = (kind: Enums<'answer_kind'>, promptKey: string, value: string) => Promise<string | null>;

// RLS returns my answers plus my partner's only for prompts I've answered, so rows need no client-side hiding.
// The answer_revealed event is written by the trigger at the exact moment a prompt becomes visible to both,
// so it's the one signal worth subscribing to; polling would mostly fetch nothing new.
function useAnswers(bookId: string, spine: number): { answers: Answer[]; submit: Submit } {
  const [answers, setAnswers] = useState<Answer[]>([]);

  const refetch = useCallback(async () => {
    const db = createBrowserClient();
    const { data, error } = await db.from('answer').select().eq('book_id', bookId).eq('spine', spine);
    if (error) return console.error(error);
    setAnswers(data);
  }, [bookId, spine]);

  useEffect(() => {
    const db = createBrowserClient();
    const channel = db
      .channel(`discussion:${bookId}:${spine}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event', filter: `book_id=eq.${bookId}` }, ({ new: e }) => {
        if (e.type === 'answer_revealed' && e.data?.spine === spine) void refetch();
      })
      // A reveal can land between the first fetch and Postgres changes going live.
      .on('system', {}, () => void refetch());
    let alive = true;
    // Without a token in the join payload the channel joins as anon and RLS drops every event row.
    void db.realtime.setAuth().then(() => alive && channel.subscribe());
    void refetch();
    return () => {
      alive = false;
      void db.removeChannel(channel);
    };
  }, [bookId, spine, refetch]);

  const submit: Submit = async (kind, promptKey, value) => {
    const db = createBrowserClient();
    const { error } = await db.from('answer').insert({ book_id: bookId, spine, kind, prompt_key: promptKey, value });
    await refetch();
    if (error && error.code !== '23505') return 'Could not save your answer. Try again.';
    return null;
  };

  return { answers, submit };
}

type Pair = { mine?: Answer; theirs?: Answer };

function pairFor(answers: Answer[], promptKey: string, me: Member): Pair {
  const rows = answers.filter((a) => a.prompt_key === promptKey);
  return { mine: rows.find((a) => a.user_id === me.userId), theirs: rows.find((a) => a.user_id !== me.userId) };
}

export function Discussion({ bookId, spine, me, partner }: { bookId: string; spine: number; me: Member; partner: Member | null }) {
  const { answers, submit } = useAnswers(bookId, spine);
  const partnerName = partner?.name ?? 'your partner';
  return (
    <div className="flex flex-col gap-6">
      {questionsFor(spine).map((q) => (
        <QuestionCard
          key={q.key}
          text={q.text}
          pair={pairFor(answers, q.key, me)}
          me={me}
          partner={partner}
          partnerName={partnerName}
          onSubmit={(value) => submit('question', q.key, value)}
        />
      ))}
      <GuessCard
        pair={pairFor(answers, guessKey(spine), me)}
        partnerName={partnerName}
        onSubmit={(g) => submit('guess', guessKey(spine), JSON.stringify(g))}
      />
    </div>
  );
}

function Waiting({ partnerName }: { partnerName: string }) {
  return (
    <p className="text-gray-600" role="status">
      Waiting for {partnerName}…
    </p>
  );
}

function Said({ who, color, children }: { who: string; color: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-md border-l-4 bg-gray-50 p-3" style={{ borderColor: color }}>
      <span className="text-sm font-semibold" style={{ color }}>
        {who}
      </span>
      <p className="whitespace-pre-wrap">{children}</p>
    </div>
  );
}

function QuestionCard({
  text,
  pair,
  me,
  partner,
  partnerName,
  onSubmit,
}: {
  text: string;
  pair: Pair;
  me: Member;
  partner: Member | null;
  partnerName: string;
  onSubmit: (value: string) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    const value = draft.trim();
    if (!value) return;
    setBusy(true);
    setError(await onSubmit(value));
    setBusy(false);
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4" aria-label={text}>
      <h2 className="font-semibold">{text}</h2>
      {!pair.mine ? (
        <form onSubmit={send} className="flex flex-col gap-2">
          <textarea
            aria-label="Your answer"
            className="min-h-24 rounded-md border p-2"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
          />
          <p className="text-sm text-gray-600">{partnerName} sees it only after answering too.</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={busy || !draft.trim()} className="self-start">
            Answer
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Said who="You" color={me.color}>
            {pair.mine.value}
          </Said>
          {pair.theirs ? (
            <Said who={partnerName} color={partner?.color ?? '#9ca3af'}>
              {pair.theirs.value}
            </Said>
          ) : (
            <Waiting partnerName={partnerName} />
          )}
        </div>
      )}
    </section>
  );
}

function ReactionPicker({ label, value, onChange }: { label: string; value: GuessReaction | null; onChange: (r: GuessReaction) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {GUESS_OPTIONS.map((o) => (
          <Button key={o.key} type="button" variant={value === o.key ? 'default' : 'outline'} aria-pressed={value === o.key} onClick={() => onChange(o.key)}>
            {o.emoji} {o.label}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}

function GuessCard({ pair, partnerName, onSubmit }: { pair: Pair; partnerName: string; onSubmit: (g: Guess) => Promise<string | null> }) {
  const [mine, setMine] = useState<GuessReaction | null>(null);
  const [guessPartner, setGuessPartner] = useState<GuessReaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const me = pair.mine && parseGuess(pair.mine.value);
  const them = pair.theirs && parseGuess(pair.theirs.value);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!mine || !guessPartner) return;
    setBusy(true);
    setError(await onSubmit({ mine, guessPartner }));
    setBusy(false);
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4" aria-label="Guess their reaction">
      <h2 className="font-semibold">Guess their reaction</h2>
      {!me ? (
        <form onSubmit={send} className="flex flex-col gap-4">
          <ReactionPicker label="How did this chapter make you feel?" value={mine} onChange={setMine} />
          <ReactionPicker label={`How do you think ${partnerName} felt?`} value={guessPartner} onChange={setGuessPartner} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={busy || !mine || !guessPartner} className="self-start">
            Lock it in
          </Button>
        </form>
      ) : !them ? (
        <>
          <p>
            You: {emojiOf(me.mine)} · your guess for {partnerName}: {emojiOf(me.guessPartner)}
          </p>
          <Waiting partnerName={partnerName} />
        </>
      ) : (
        <GuessResult me={me} them={them} partnerName={partnerName} />
      )}
    </section>
  );
}

function GuessResult({ me, them, partnerName }: { me: Guess; them: Guess; partnerName: string }) {
  const r = revealGuess(me, them);
  return (
    <div className="flex flex-col gap-1" data-testid="guess-result">
      <p className="text-2xl">
        You: {emojiOf(me.mine)} {partnerName}: {emojiOf(them.mine)}
      </p>
      <p className="font-semibold">{r.same ? '🎉 Same reaction!' : 'Different reactions this time.'}</p>
      <p>{r.iGuessedRight ? `You guessed ${partnerName} right.` : `You guessed ${emojiOf(me.guessPartner)} for ${partnerName}.`}</p>
      <p>{r.theyGuessedRight ? `${partnerName} guessed you right.` : `${partnerName} guessed ${emojiOf(them.guessPartner)} for you.`}</p>
    </div>
  );
}
