'use client';

import { useState } from 'react';
import { buildProfile, profileToRows } from '../../lib/record-fields.js';
import { commitUrl, shortSha } from '../../lib/repo.js';

const MAX_LINKS = 8;

const INPUT =
  'slit-input w-full bg-transparent px-3 py-2 font-(family-name:--font-mono) text-sm text-(--color-ink) placeholder:text-(--color-muted)/70';

// The profile card editor, on its own page: display name, bio, and links.
// It saves exactly one key — `profile` — so nothing here can ever touch DNS
// records or subdomain entries; the API leaves absent keys untouched. When
// the name points somewhere (DNS in the file), the page also offers the one
// control anywhere in the product that removes records: a two-click "turn
// off DNS", which makes the name serve this card again.
export default function ProfileForm({ name, record }) {
  const [displayName, setDisplayName] = useState(record.profile?.name ?? '');
  const [bio, setBio] = useState(record.profile?.bio ?? '');
  const [linkRows, setLinkRows] = useState(() => profileToRows(record.profile));
  const [status, setStatus] = useState(null); // saving | saved | unchanged | error
  const [errors, setErrors] = useState([]);
  const [commit, setCommit] = useState(null);
  const [stopArmed, setStopArmed] = useState(false);
  const [dnsOff, setDnsOff] = useState(false);

  const dnsInFile = Object.keys(record.records ?? {}).length > 0;

  function setLinkRow(i, patch) {
    setLinkRows((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setStatus(null);
  }
  function removeLink(i) {
    setLinkRows((rows) => rows.filter((_, j) => j !== i));
    setStatus(null);
  }

  async function save() {
    setStatus('saving');
    setErrors([]);
    // The payload carries only `profile`: records and subdomains are absent,
    // and the API leaves absent keys exactly as the file holds them.
    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          profile: buildProfile({ name: displayName, bio, linkRows }) ?? null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setCommit(body.commit ?? null);
        setStatus(body.unchanged ? 'unchanged' : 'saved');
        return;
      }
      setErrors(body.details ?? ['Could not save just now.']);
      setStatus('error');
    } catch {
      setStatus('error');
    }
  }

  // Turning DNS off lives here and only here: two clicks, posting
  // `records: {}` and nothing else.
  async function stopDns() {
    if (!stopArmed) { setStopArmed(true); return; }
    setStopArmed(false);
    setStatus('saving');
    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, records: {} }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setCommit(body.commit ?? null);
        setStatus(body.unchanged ? 'unchanged' : 'saved');
        if (!body.unchanged) setDnsOff(true);
        return;
      }
      setErrors(body.details ?? ['Could not save just now.']);
      setStatus('error');
    } catch {
      setStatus('error');
    }
  }

  const sha = shortSha(commit);

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="slit-frame rounded-lg">
      <div className="flex flex-wrap items-center justify-between gap-4 slit-bottom px-6 py-5 sm:px-8">
        <div>
          <p className="font-(family-name:--font-mono) text-xs text-(--color-muted)">domains/{name}.json</p>
          <h2 className="mt-1.5 text-[23px] leading-[1.07] font-normal tracking-[-0.004em] text-(--color-ink)">{name}.runs-on.dev</h2>
        </div>
      </div>

      <div className="px-6 py-5 sm:px-8">
        <p className="text-[14px] text-(--color-ink)">Profile card details</p>
        <p className="mt-1.5 text-xs leading-relaxed text-(--color-muted)">
          {dnsInFile && !dnsOff
            ? 'Saved with your name and shown if you ever turn DNS off. Saving these never changes where the name points.'
            : 'Override any field below. Blank falls back to your GitHub profile.'}
        </p>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="meta normal-case">display name</span>
            <input value={displayName} onChange={(e) => { setDisplayName(e.target.value); setStatus(null); }} placeholder="GitHub profile name" className={`mt-2 ${INPUT}`} />
          </label>
          <label className="block">
            <span className="meta normal-case">bio</span>
            <textarea value={bio} onChange={(e) => { setBio(e.target.value); setStatus(null); }} placeholder="GitHub profile bio" rows={2} className={`mt-2 ${INPUT} resize-y`} />
          </label>
          {linkRows.map((row, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input value={row.label} onChange={(e) => setLinkRow(i, { label: e.target.value })} placeholder="My portfolio" aria-label="Link label" className={`w-36 ${INPUT}`} />
              <input value={row.url} onChange={(e) => setLinkRow(i, { url: e.target.value })} placeholder="https://…" aria-label="Link URL" spellCheck={false} className={`min-w-0 flex-1 ${INPUT}`} />
              <button type="button" onClick={() => removeLink(i)} className="font-(family-name:--font-mono) text-xs text-(--color-muted) underline transition-colors hover:text-(--color-ink)">remove</button>
            </div>
          ))}
          {linkRows.length < MAX_LINKS && (
            <button type="button" onClick={() => { setLinkRows((rows) => [...rows, { label: '', url: '' }]); setStatus(null); }} className="slit-frame rounded-[4px] px-3 py-1.5 font-(family-name:--font-mono) text-xs text-(--color-muted) hover:text-(--color-ink)">+ add a link</button>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={status === 'saving'} className="btn-pill">
            {status === 'saving' ? 'Saving…' : 'Save profile card'}
          </button>
          {status === 'unchanged' && <span className="font-(family-name:--font-mono) text-xs text-(--color-muted)">no changes to save</span>}
          {status === 'saved' && (
            <span className="font-(family-name:--font-mono) text-xs text-(--color-muted)">
              {sha ? <a className="text-(--color-ink) underline" href={commitUrl(commit)} target="_blank" rel="noopener noreferrer">commit {sha}</a> : 'saved'}
            </span>
          )}
          {errors.length > 0 && <ul className="mt-2 space-y-1 font-(family-name:--font-mono) text-xs text-(--color-flag)">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        </div>

        {/* The only control anywhere in the product that removes records:
            explicit, scoped to DNS, two clicks, and it cannot fire as a side
            effect of saving the card. */}
        {dnsInFile && !dnsOff && (
          <div className="mt-8 slit-top pt-5">
            <p className="text-[14px] text-(--color-ink)">Turn DNS off</p>
            <p className="mt-1.5 max-w-[600px] text-xs leading-relaxed text-(--color-muted)">
              Makes the name serve this profile card again and removes the DNS records it
              has now. Your profile fields and subdomain records are kept. This is the
              only place a save removes DNS.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={stopDns}
                disabled={status === 'saving'}
                className={`rounded-[4px] px-4 py-2 font-(family-name:--font-mono) text-xs transition-colors ${
                  stopArmed
                    ? 'bg-(--color-flag)/10 text-(--color-flag) slit-frame slit-frame-flag'
                    : 'text-(--color-muted) slit-frame hover:text-(--color-ink)'
                }`}
              >
                {stopArmed ? 'click again to confirm' : 'turn off DNS'}
              </button>
              {stopArmed && (
                <button type="button" onClick={() => setStopArmed(false)} className="btn-ghost px-4 py-2 text-xs">
                  keep DNS
                </button>
              )}
              {status === 'saved' && (
                <span className="font-(family-name:--font-mono) text-xs text-(--color-muted)">DNS is off — the card is live</span>
              )}
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
