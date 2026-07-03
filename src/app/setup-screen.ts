import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { sharedStyles, icons } from './ui-shared.ts';
import type { GridSize } from '../engine/lattice.ts';
import type { Difficulty } from '../ai/ai.ts';

export type SetupMode = 'local' | 'ai' | 'online';

export interface StartDetail {
  mode: SetupMode;
  gridSize: GridSize;
  names: [string, string];
  difficulty: Difficulty;
  autoplay: boolean;
}

export interface InviteInfo {
  roomId: string;
  hostName: string;
  gridSize: GridSize;
  inProgress: boolean;
}

/**
 * Pre-game flow: mode choice → configuration → (online) waiting room.
 * Emits 'start' (local/ai), 'create-online', 'join-online'. When `invite`
 * is set (the visitor followed a ?room= link) it renders the invitation.
 */
@customElement('setup-screen')
export class SetupScreen extends LitElement {
  @property({ attribute: false }) invite: InviteInfo | null = null;
  @property({ attribute: false }) shareUrl: string | null = null;
  @property() errorText = '';
  @property() busyText = '';

  @state() private mode: SetupMode | null = null;
  @state() private gridSize: GridSize = 4;
  @state() private name1 = '';
  @state() private name2 = '';
  @state() private difficulty: Difficulty = 'medium';
  @state() private autoplay = true;
  @state() private helpOpen = false;
  @state() private copied = false;

  static styles = [
    sharedStyles,
    css`
      :host {
        display: grid;
        place-items: center;
        min-height: 100%;
        padding: var(--space-5);
      }
      .wrap {
        width: min(480px, 100%);
      }
      .title {
        text-align: center;
        margin-bottom: var(--space-5);
      }
      .title h1 {
        font-size: var(--text-2xl);
        margin-bottom: var(--space-1);
      }
      .title .muted {
        margin: 0;
      }
      .modes {
        display: grid;
        gap: var(--space-3);
      }
      .mode-btn {
        text-align: left;
        display: block;
        width: 100%;
      }
      .mode-btn strong {
        display: block;
        font-size: var(--text-lg);
      }
      .mode-btn span {
        color: var(--text-dim);
        font-size: var(--text-sm);
      }
      .row {
        display: flex;
        gap: var(--space-3);
      }
      .row > * {
        flex: 1;
      }
      .actions {
        display: flex;
        gap: var(--space-3);
        margin-top: var(--space-5);
      }
      .actions .primary {
        flex: 1;
      }
      .check {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        color: var(--text);
        font-size: var(--text-sm);
        margin: 0;
        cursor: pointer;
      }
      .share {
        display: flex;
        gap: var(--space-2);
        margin: var(--space-4) 0;
      }
      .share input {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
      }
      .spinner {
        width: 22px;
        height: 22px;
        border: 3px solid var(--border-strong);
        border-top-color: var(--accent);
        border-radius: 50%;
        animation: spin 0.9s linear infinite;
        margin: 0 auto var(--space-3);
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .spinner {
          animation: none;
        }
      }
      .error {
        color: var(--danger);
        font-size: var(--text-sm);
        margin-top: var(--space-3);
      }
      .help-link {
        margin-top: var(--space-4);
        text-align: center;
      }
      svg {
        fill: currentColor;
      }
    `,
  ];

  render() {
    return html`
      <div class="wrap">
        <div class="title">
          <h1>Dots 3D</h1>
          <p class="muted">Dots and boxes, in three dimensions</p>
        </div>
        <div class="card">${this.renderStep()}</div>
        <div class="help-link">
          <button class="btn quiet" @click=${() => (this.helpOpen = true)}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill-rule="evenodd" d=${icons.help} /></svg>
            How to play
          </button>
        </div>
      </div>
      <how-to-play .open=${this.helpOpen} @closed=${() => (this.helpOpen = false)}></how-to-play>
    `;
  }

  private renderStep() {
    if (this.busyText) {
      return html`<div class="spinner" role="status" aria-label=${this.busyText}></div>
        <p class="muted" style="text-align:center">${this.busyText}</p>`;
    }
    if (this.shareUrl) return this.renderWaiting();
    if (this.invite) return this.renderInvite();
    if (this.mode === null) return this.renderModes();
    return this.renderConfig();
  }

  private renderModes() {
    return html`
      <h2>New game</h2>
      <div class="modes">
        <button class="btn mode-btn" @click=${() => (this.mode = 'local')}>
          <strong>Two players, one screen</strong>
          <span>Pass and play on this device</span>
        </button>
        <button class="btn mode-btn" @click=${() => (this.mode = 'ai')}>
          <strong>Versus computer</strong>
          <span>Three difficulty levels</span>
        </button>
        <button class="btn mode-btn" @click=${() => (this.mode = 'online')}>
          <strong>Online with a friend</strong>
          <span>Share a link, play from anywhere</span>
        </button>
      </div>
      ${this.errorText ? html`<p class="error">${this.errorText}</p>` : nothing}
    `;
  }

  private renderConfig() {
    const mode = this.mode!;
    return html`
      <h2>
        ${mode === 'local' ? 'Two players' : mode === 'ai' ? 'Versus computer' : 'Online game'}
      </h2>
      <div class="field">
        <label for="grid">Grid size</label>
        <select id="grid" .value=${String(this.gridSize)} @change=${this.onGrid}>
          <option value="3">3 × 3 × 3 — quick (8 cubes)</option>
          <option value="4">4 × 4 × 4 — classic (27 cubes)</option>
          <option value="5">5 × 5 × 5 — long (64 cubes)</option>
          <option value="6">6 × 6 × 6 — marathon (125 cubes)</option>
        </select>
      </div>
      <div class="row">
        <div class="field">
          <label for="n1">${mode === 'local' ? 'Player 1' : 'Your name'}</label>
          <input id="n1" type="text" maxlength="24" placeholder="Player 1"
            .value=${this.name1} @input=${(e: InputEvent) => (this.name1 = this.inputValue(e))} />
        </div>
        ${mode === 'local'
          ? html`<div class="field">
              <label for="n2">Player 2</label>
              <input id="n2" type="text" maxlength="24" placeholder="Player 2"
                .value=${this.name2} @input=${(e: InputEvent) => (this.name2 = this.inputValue(e))} />
            </div>`
          : nothing}
        ${mode === 'ai'
          ? html`<div class="field">
              <label for="diff">Difficulty</label>
              <select id="diff" .value=${this.difficulty}
                @change=${(e: Event) => (this.difficulty = (e.target as HTMLSelectElement).value as Difficulty)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>`
          : nothing}
      </div>
      <label class="check">
        <input type="checkbox" .checked=${this.autoplay}
          @change=${(e: Event) => (this.autoplay = (e.target as HTMLInputElement).checked)} />
        Auto-play forced chain moves
      </label>
      ${this.errorText ? html`<p class="error">${this.errorText}</p>` : nothing}
      <div class="actions">
        <button class="btn quiet" @click=${() => (this.mode = null)}>Back</button>
        <button class="btn primary" @click=${this.onStart}>
          ${mode === 'online' ? 'Create game' : 'Start game'}
        </button>
      </div>
    `;
  }

  private renderWaiting() {
    return html`
      <div class="spinner" role="status" aria-label="Waiting for opponent"></div>
      <h2 style="text-align:center">Waiting for your opponent</h2>
      <p class="muted">Send them this link — the game starts the moment they join:</p>
      <div class="share">
        <input type="text" readonly .value=${this.shareUrl ?? ''} @focus=${this.selectAll} />
        <button class="btn" @click=${this.copyLink}>
          <svg width="16" height="16" viewBox="0 0 24 24"><path fill-rule="evenodd" d=${icons.copy} /></svg>
          ${this.copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <button class="btn quiet" @click=${() => this.dispatch('cancel-online')}>Cancel</button>
    `;
  }

  private renderInvite() {
    const inv = this.invite!;
    return html`
      <h2>${inv.hostName} invited you</h2>
      <p class="muted">
        ${inv.inProgress
          ? 'This game is in progress — join to reconnect or watch.'
          : `Dots 3D on a ${inv.gridSize} × ${inv.gridSize} × ${inv.gridSize} grid.`}
      </p>
      <div class="field">
        <label for="jn">Your name</label>
        <input id="jn" type="text" maxlength="24" placeholder="Player 2"
          .value=${this.name1} @input=${(e: InputEvent) => (this.name1 = this.inputValue(e))} />
      </div>
      ${this.errorText ? html`<p class="error">${this.errorText}</p>` : nothing}
      <div class="actions">
        <button class="btn quiet" @click=${() => this.dispatch('decline-invite')}>No thanks</button>
        <button class="btn primary" @click=${this.onJoin}>Join game</button>
      </div>
    `;
  }

  // ---- events ----

  private onGrid = (e: Event) => {
    this.gridSize = Number((e.target as HTMLSelectElement).value) as GridSize;
  };

  private inputValue(e: InputEvent): string {
    return (e.target as HTMLInputElement).value;
  }

  private onStart = () => {
    const detail: StartDetail = {
      mode: this.mode!,
      gridSize: this.gridSize,
      names: [
        this.name1.trim() || 'Player 1',
        this.mode === 'ai' ? 'Computer' : this.name2.trim() || 'Player 2',
      ],
      difficulty: this.difficulty,
      autoplay: this.autoplay,
    };
    this.dispatch(this.mode === 'online' ? 'create-online' : 'start', detail);
  };

  private onJoin = () => {
    this.dispatch('join-online', { name: this.name1.trim() || 'Player 2' });
  };

  private dispatch(type: string, detail?: unknown) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  private copyLink = async () => {
    if (!this.shareUrl) return;
    await navigator.clipboard.writeText(this.shareUrl).catch(() => {});
    this.copied = true;
    setTimeout(() => (this.copied = false), 1600);
  };

  private selectAll = (e: FocusEvent) => (e.target as HTMLInputElement).select();
}

declare global {
  interface HTMLElementTagNameMap {
    'setup-screen': SetupScreen;
  }
}
