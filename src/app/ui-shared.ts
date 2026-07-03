/**
 * Shared styles for all Lit components — one design system, consumed via
 * the tokens in src/styles/tokens.css (which pierce shadow DOM as CSS
 * custom properties). The prototype copy-pasted its stylesheet into six
 * innerHTML blocks; this is the antidote.
 */

import { css } from 'lit';

export const sharedStyles = css`
  * {
    box-sizing: border-box;
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    box-shadow: var(--shadow);
  }

  h1,
  h2,
  h3 {
    margin: 0 0 var(--space-4);
    font-weight: 650;
    letter-spacing: -0.01em;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    font: inherit;
    font-size: var(--text-md);
    font-weight: 550;
    color: var(--text);
    background: var(--surface-raised);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-5);
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease),
      border-color var(--dur-fast) var(--ease),
      transform var(--dur-fast) var(--ease);
  }
  .btn:hover {
    border-color: var(--accent);
    background: #232c3a;
  }
  .btn:active {
    transform: scale(0.98);
  }
  .btn:focus-visible,
  input:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .btn.primary {
    background: var(--accent-strong);
    border-color: var(--accent-strong);
    color: #fff;
  }
  .btn.primary:hover {
    background: var(--accent);
  }
  .btn.quiet {
    background: transparent;
    border-color: transparent;
    color: var(--text-dim);
  }
  .btn.quiet:hover {
    color: var(--text);
    border-color: var(--border);
  }
  .btn:disabled {
    opacity: 0.45;
    cursor: default;
    pointer-events: none;
  }

  label {
    display: block;
    font-size: var(--text-sm);
    color: var(--text-dim);
    margin-bottom: var(--space-1);
  }

  input[type='text'],
  select {
    font: inherit;
    width: 100%;
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    padding: var(--space-3);
  }

  .field {
    margin-bottom: var(--space-4);
  }

  .muted {
    color: var(--text-dim);
    font-size: var(--text-sm);
  }

  .seat-0 {
    color: var(--player-1);
  }
  .seat-1 {
    color: var(--player-2);
  }
`;

/** Inline SVG icons (no emoji-as-UI). */
export const icons = {
  help: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm-.9-6.5h1.9v1.9h-1.9v-1.9Zm2.87-5.02c-.46.61-1.97 1.42-1.97 2.52v.6h-1.9v-.75c0-1.55 1.5-2.34 2.05-3.06.42-.55.42-1.79-1.05-1.79-1.13 0-1.44.86-1.5 1.4l-1.94-.34C7.83 7.6 9.11 6 11.1 6c2.63 0 3.9 2.44 2.87 4.48Z',
  camera: 'M12 9a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm9-2h-3.2l-1.2-2H7.4L6.2 7H3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1Zm-9 11a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11Z',
  layers: 'M12 2 1 8l11 6 9.9-5.4V16h2V8L12 2Zm-7 10.5-4 2.2 11 6 11-6-4-2.2-7 3.8-7-3.8Z',
  copy: 'M16 1H4a2 2 0 0 0-2 2v13h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z',
  close: 'M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4Z',
} as const;
