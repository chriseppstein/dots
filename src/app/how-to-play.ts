import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { sharedStyles, icons } from './ui-shared.ts';

/**
 * Rules dialog, reachable from every screen — the prototype only showed
 * rules to online invitees.
 */
@customElement('how-to-play')
export class HowToPlay extends LitElement {
  @property({ type: Boolean }) open = false;

  static styles = [
    sharedStyles,
    css`
      .backdrop {
        position: fixed;
        inset: 0;
        background: var(--surface-overlay);
        display: grid;
        place-items: center;
        padding: var(--space-4);
        z-index: 100;
      }
      .dialog {
        max-width: 520px;
        max-height: 85vh;
        overflow-y: auto;
        position: relative;
      }
      .close {
        position: absolute;
        top: var(--space-3);
        right: var(--space-3);
      }
      ol {
        padding-left: 1.2em;
        line-height: 1.6;
        margin: 0 0 var(--space-4);
      }
      li {
        margin-bottom: var(--space-2);
      }
      .signals {
        display: grid;
        gap: var(--space-2);
        margin-bottom: var(--space-4);
      }
      .signal {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        font-size: var(--text-sm);
      }
      .swatch {
        width: 26px;
        height: 8px;
        border-radius: 4px;
        flex: none;
      }
      svg {
        fill: currentColor;
      }
    `,
  ];

  render() {
    if (!this.open) return nothing;
    return html`
      <div class="backdrop" @click=${this.onBackdrop}>
        <div class="card dialog" role="dialog" aria-modal="true" aria-label="How to play">
          <button class="btn quiet close" @click=${this.close} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill-rule="evenodd" d=${icons.close} /></svg>
          </button>
          <h2>How to play</h2>
          <ol>
            <li>Take turns drawing lines between neighboring dots.</li>
            <li>Draw the 4th side of a square to claim that <strong>face</strong> — and go again.</li>
            <li>Claim <strong>4 of the 6 faces</strong> of a small cube to win that <strong>cube</strong>.</li>
            <li>Most cubes wins. Claim more than half of them and the game ends immediately — no comeback is possible. Otherwise it runs until every line is drawn (faces split 3–3 leave a cube unclaimed).</li>
          </ol>
          <h3>Line colors when you aim</h3>
          <div class="signals">
            <div class="signal"><span class="swatch" style="background: var(--safe)"></span> Safe — gives nothing away</div>
            <div class="signal"><span class="swatch" style="background: var(--scoring)"></span> Completes a face (you go again)</div>
            <div class="signal"><span class="swatch" style="background: var(--chain)"></span> Starts a chain of faces</div>
            <div class="signal"><span class="swatch" style="background: var(--danger)"></span> Careful — sets up your opponent</div>
          </div>
          <h3>Controls</h3>
          <p class="muted">
            Drag to spin the cube — either mouse button, or one finger on touch. Scroll or pinch
            to zoom. Click a line to draw it (on touch: tap to preview, press and hold to draw).
            Use the slice tool to see inside the grid.
          </p>
          <button class="btn primary" @click=${this.close}>Got it</button>
        </div>
      </div>
    `;
  }

  private close = () => {
    this.open = false;
    this.dispatchEvent(new CustomEvent('closed'));
  };

  private onBackdrop = (ev: MouseEvent) => {
    if (ev.target === ev.currentTarget) this.close();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'how-to-play': HowToPlay;
  }
}
