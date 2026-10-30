import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CircleDot, Info, Lock, PackageOpen, RotateCw, type LucideIcon } from 'lucide-react';
import './feedback.css';

/** Shared text patterns (Notice, EmptyState, ActivityList); use these instead of plain grey text. Mockup: claude.ai/artifact/C4m6GV7UunRZMN1XWB3Wob */

export type Tone = 'ok' | 'wait' | 'warn' | 'bad' | 'none';

/** One short in-page message. info = good to know, warn = blocking you now, lock = another role does this. `more` is the muted second sentence. */
export function Notice({ tone = 'info', icon: Icon, children, more, role }: {
  tone?: 'info' | 'warn' | 'lock' | 'ok' | 'bad'; icon?: LucideIcon; children: React.ReactNode; more?: React.ReactNode; role?: 'status' | 'alert';
}) {
  const I = Icon ?? (tone === 'lock' ? Lock : tone === 'warn' || tone === 'bad' ? AlertTriangle : Info);
  return (
    <div className={`fb-notice ${tone}`} role={role}>
      <I aria-hidden="true" />
      <div>{children}{more && <> <span className="fb-more">{more}</span></>}</div>
    </div>
  );
}

/** Fills the space the data would take. Passing onRetry makes it an error with a Try again button. */
export function EmptyState({ icon: Icon, title, description, action, onRetry }: {
  icon?: LucideIcon; title: string; description?: React.ReactNode;
  action?: { label: string; icon?: LucideIcon } & ({ onClick: () => void } | { to: string }); onRetry?: () => void;
}) {
  const err = !!onRetry;
  const I = Icon ?? (err ? AlertTriangle : PackageOpen);
  const a = err ? { label: 'Try again', onClick: onRetry!, icon: RotateCw } : action;
  return (
    <div className={`fb-empty${err ? ' err' : ''}`} role={err ? 'alert' : undefined}>
      <I aria-hidden="true" />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {a && ('to' in a
        ? <Link to={a.to} className="fb-btn">{a.icon && <a.icon aria-hidden="true" />}{a.label}</Link>
        : <button type="button" className="fb-btn" onClick={a.onClick}>{a.icon && <a.icon aria-hidden="true" />}{a.label}</button>)}
    </div>
  );
}

export type Activity = {
  at: string; title: React.ReactNode; icon?: LucideIcon; tone?: Tone;
  chip?: string; detail?: React.ReactNode; actor?: { id: number; name: string } | null;
};

const dayKey = (d: Date) => d.toDateString();
function dayLabel(d: Date) {
  const today = new Date(), y = new Date(today); y.setDate(today.getDate() - 1);
  if (dayKey(d) === dayKey(today)) return 'Today';
  if (dayKey(d) === dayKey(y)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', ...(d.getFullYear() !== today.getFullYear() && { year: 'numeric' }) });
}
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('');

/** Who did what and when, grouped by day, newest first as given. `origin` ends the timeline (for example where recording started). */
export function ActivityList({ items, meId, origin, label }: { items: Activity[]; meId?: number; origin?: React.ReactNode; label?: string }) {
  const groups: { day: string; rows: Activity[] }[] = [];
  for (const it of items) {
    const d = new Date(it.at), last = groups[groups.length - 1];
    if (last && dayKey(new Date(last.rows[0]!.at)) === dayKey(d)) last.rows.push(it);
    else groups.push({ day: dayLabel(d), rows: [it] });
  }
  return (
    <div className="fb-act" aria-label={label}>
      {groups.map(g => (
        <React.Fragment key={g.day}>
          <div className="fb-day">{g.day}</div>
          <ol className="fb-tl">
            {g.rows.map((r, i) => {
              const I = r.icon ?? CircleDot, me = !!r.actor && r.actor.id === meId;
              return (
                <li key={`${r.at}-${i}`}>
                  <span className={`fb-ico ${r.tone ?? 'ok'}`}><I aria-hidden="true" /></span>
                  <div className="fb-body">
                    <div className="fb-l1">{r.title}{r.chip && <span className={`fb-chip ${r.tone ?? 'ok'}`}>{r.chip}</span>}</div>
                    {(r.actor !== undefined || r.detail) && <div className="fb-l2">
                      {r.detail}
                      {r.actor !== undefined && <span className="fb-who">
                        {r.actor && <span className={`fb-av${me ? ' me' : ''}`} aria-hidden="true">{initials(r.actor.name)}</span>}
                        {me ? 'You' : r.actor?.name ?? 'Unknown'}</span>}
                    </div>}
                  </div>
                  <time className="fb-when" dateTime={r.at}>{new Date(r.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</time>
                </li>
              );
            })}
          </ol>
        </React.Fragment>
      ))}
      {origin && <div className="fb-origin"><p>{origin}</p></div>}
    </div>
  );
}
