'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DuetRibbon, type RibbonMark } from '@/components/ui/duet-ribbon';
import { Avatar, InkDot, InkSwatches } from '@/components/ui/ink';
import { Sheet } from '@/components/ui/sheet';
import { Toast } from '@/components/ui/toast';
import { INKS } from '@/features/couple/palette';

const alex = (page: number, color = '#d6336c'): RibbonMark => ({ name: 'Alex', color, page, pos: page, isMe: false });
const me = (page: number, color = '#3b5bdb'): RibbonMark => ({ name: 'Sam', color, page, pos: page, isMe: true });

const RIBBONS: { title: string; marks: RibbonMark[] }[] = [
  { title: 'Apart', marks: [alex(42), me(118)] },
  { title: 'Side by side', marks: [alex(42), me(38)] },
  { title: 'Same page', marks: [alex(100), me(100)] },
  { title: 'Both at the start', marks: [alex(1), me(2)] },
  { title: 'Both at the end', marks: [alex(199), me(200)] },
  { title: 'Solo', marks: [me(64)] },
];

function Panel({ dark }: { dark?: boolean }) {
  const [ink, setInk] = useState<string>('#3b5bdb');
  const [open, setOpen] = useState(false);
  return (
    <section className={`${dark ? 'dark' : ''} flex min-w-0 flex-1 flex-col gap-8 bg-background p-4 text-foreground sm:p-8`}>
      <h2 className="text-2xl">{dark ? 'Dark' : 'Light'}</h2>

      <div className="flex flex-col gap-3">
        <h3 className="text-xl">Type</h3>
        <p className="font-serif text-4xl font-semibold">Alice&apos;s Adventures in Wonderland</p>
        <p className="text-muted-foreground">Lewis Carroll</p>
        <blockquote className="text-xl">&ldquo;Curiouser and curiouser!&rdquo; cried Alice.</blockquote>
        <p>Sam left you something on page 42. Keep reading to see it.</p>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-xl">Buttons</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="md">Keep reading</Button>
          <Button size="md" variant="outline">
            Add a book
          </Button>
          <Button size="md" variant="quiet">
            Not now
          </Button>
          <Button size="md" disabled>
            Disabled
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Keep reading</Button>
          <Button size="sm" variant="outline">
            Add a book
          </Button>
          <Button size="sm" variant="quiet">
            Not now
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-xl">Inks</h3>
        <div className="flex flex-wrap items-center gap-4">
          {INKS.map((i) => (
            <span key={i.color} className="flex items-center gap-1.5 text-sm">
              <InkDot color={i.color} /> {i.name}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Avatar name="Alex" color="#d6336c" />
          <Avatar name="Sam" color={ink} />
          <Avatar name="Alex" color="#d6336c" size="sm" />
        </div>
        <InkSwatches name={dark ? 'ink-dark' : 'ink-light'} value={ink} onChange={setInk} exclude={['#d6336c']} />
      </div>

      <div className="flex flex-col gap-5">
        <h3 className="text-xl">Duet ribbon (200 pages)</h3>
        {RIBBONS.map((r) => (
          <div key={r.title} className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">{r.title}</span>
            <DuetRibbon total={200} marks={r.marks} />
          </div>
        ))}
        <div className="flex max-w-40 flex-col gap-2">
          <div className="aspect-[2/3] rounded-cover bg-wash" />
          <DuetRibbon total={200} marks={[alex(42), me(38)]} size="sm" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-xl">Sheet and toast</h3>
        <div>
          <Button size="md" variant="outline" onClick={() => setOpen(true)}>
            Open sheet
          </Button>
        </div>
        <Sheet open={open} onOpenChange={setOpen} title="Bookmarks" description="Places you both saved.">
          <p>Chapter 3, page 42</p>
          <Button size="md" onClick={() => setOpen(false)}>
            Done
          </Button>
        </Sheet>
        <Toast className="static mx-0" color="#d6336c" action={<Button size="sm" variant="quiet">Show me</Button>}>
          Alex left you something
        </Toast>
      </div>
    </section>
  );
}

export function DevUi() {
  return (
    <main className="flex flex-col lg:flex-row">
      <Panel />
      <Panel dark />
    </main>
  );
}
