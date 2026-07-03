import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { sharedStyles, icons } from './ui-shared.ts';
import { BoardRenderer } from '../render/board-renderer.ts';
import { analyzeAllMoves, type MoveAnalysis } from '../engine/analyzer.ts';
import { scores, faceCounts, type Seat } from '../engine/game.ts';
import type { GameSession, SessionSnapshot } from './session.ts';
import { consequenceLabel, CONSEQUENCE_COLORS } from './theme.ts';
import type { Axis } from '../engine/lattice.ts';

interface OnlineStatus {
  mySeat: Seat;
  opponentConnected: boolean;
  connection: 'connecting' | 'open' | 'closed';
}

/**
 * The in-game view: 3D board plus HUD. Purely reactive — everything it
 * shows derives from the session snapshot; celebrations key off the
 * lastResult of each move.
 */
@customElement('game-screen')
export class GameScreen extends LitElement {
  @property({ attribute: false }) session!: GameSession;
  @property({ attribute: false }) online: OnlineStatus | null = null;

  @state() private snap: SessionSnapshot | null = null;
  @state() private hover: MoveAnalysis | null = null;
  @state() private hoverEdge: number | null = null;
  @state() private banner: { text: string; cls: string } | null = null;
  @state() private sliceAxis: Axis | null = null;
  @state() private sliceLayer = 0;
  @state() private helpOpen = false;

  @query('#board') private boardEl!: HTMLDivElement;

  private renderer: BoardRenderer | null = null;
  private unsubscribe: (() => void) | null = null;
  private bannerTimer: ReturnType<typeof setTimeout> | null = null;

  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
        height: 100%;
        position: relative;
        overflow: hidden;
      }
      #board {
        position: absolute;
        inset: 0;
      }
      .hud {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        pointer-events: none;
      }
      .hud > * {
        pointer-events: auto;
      }
      .players {
        display: flex;
        gap: var(--space-2);
      }
      .player {
        background: var(--surface-overlay);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        padding: var(--space-2) var(--space-3);
        min-width: 108px;
        border-top: 3px solid transparent;
        transition: border-color var(--dur-med) var(--ease), opacity var(--dur-med) var(--ease);
      }
      .player.s0 {
        border-top-color: var(--player-1);
      }
      .player.s1 {
        border-top-color: var(--player-2);
      }
      .player.idle {
        opacity: 0.6;
      }
      .player .name {
        font-size: var(--text-xs);
        color: var(--text-dim);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 130px;
      }
      .player .cubes {
        font-size: var(--text-xl);
        font-weight: 700;
        line-height: 1.1;
      }
      .player .faces {
        font-size: var(--text-xs);
        color: var(--text-faint);
      }
      .turn {
        background: var(--surface-overlay);
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: var(--space-2) var(--space-4);
        font-size: var(--text-sm);
        font-weight: 600;
        white-space: nowrap;
      }
      .toolbar {
        display: flex;
        gap: var(--space-2);
      }
      .toolbar .btn {
        padding: var(--space-2) var(--space-3);
        background: var(--surface-overlay);
      }
      .chip {
        position: absolute;
        bottom: calc(var(--space-6) + env(safe-area-inset-bottom, 0px));
        left: 50%;
        transform: translateX(-50%);
        background: var(--surface-overlay);
        border: 1px solid var(--border-strong);
        border-radius: 999px;
        padding: var(--space-2) var(--space-4);
        font-size: var(--text-sm);
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: var(--space-2);
        pointer-events: none;
      }
      .chip .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }
      .banner {
        position: absolute;
        top: 84px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--surface-overlay);
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-md);
        padding: var(--space-3) var(--space-5);
        font-size: var(--text-lg);
        font-weight: 700;
        animation: pop var(--dur-med) var(--ease);
        pointer-events: none;
      }
      .banner.cube-0 {
        color: var(--player-1);
        border-color: var(--player-1);
      }
      .banner.cube-1 {
        color: var(--player-2);
        border-color: var(--player-2);
      }
      @keyframes pop {
        from {
          transform: translateX(-50%) scale(0.85);
          opacity: 0;
        }
      }
      .slice {
        position: absolute;
        left: var(--space-4);
        bottom: calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
        display: flex;
        align-items: center;
        gap: var(--space-3);
        background: var(--surface-overlay);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        padding: var(--space-2) var(--space-3);
      }
      .slice input[type='range'] {
        width: 110px;
        accent-color: var(--accent);
      }
      .overlay {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        background: var(--surface-overlay);
        z-index: 50;
        padding: var(--space-4);
      }
      .overlay .card {
        text-align: center;
        min-width: min(320px, 90vw);
      }
      .overlay .score-line {
        font-size: var(--text-lg);
        margin: var(--space-2) 0;
      }
      .notice {
        position: absolute;
        bottom: calc(var(--space-6) + 52px);
        left: 50%;
        transform: translateX(-50%);
        background: var(--surface-overlay);
        border: 1px solid var(--danger);
        border-radius: var(--radius-md);
        padding: var(--space-2) var(--space-4);
        font-size: var(--text-sm);
      }
      svg {
        fill: currentColor;
      }
      @media (max-width: 640px) {
        .player {
          min-width: 84px;
        }
        .turn {
          display: none;
        }
      }
    `,
  ];

  // ---- lifecycle ----

  protected firstUpdated(): void {
    this.renderer = new BoardRenderer({
      container: this.boardEl,
      gridSize: this.session.opts.gridSize,
      onEdgeSelect: (edgeId) => this.session.requestMove(edgeId),
      onEdgeHover: (edgeId, analysis) => {
        this.hoverEdge = edgeId;
        this.hover = analysis;
      },
    });
    this.unsubscribe = this.session.subscribe((snap) => this.onSnapshot(snap));
    this.onSnapshot(this.session.snapshot());
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('online') && this.snap) this.pushToRenderer(this.snap);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribe?.();
    this.renderer?.dispose();
    this.renderer = null;
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
  }

  private onSnapshot(snap: SessionSnapshot): void {
    this.snap = snap;
    this.pushToRenderer(snap);

    const r = snap.lastResult;
    if (r && snap.state.status === 'playing') {
      if (r.claimedCubes.length > 0 && snap.lastMove) {
        const seat = snap.lastMove.seat;
        const n = r.claimedCubes.length;
        this.showBanner(`${snap.playerNames[seat]} claims ${n === 1 ? 'a cube!' : `${n} cubes!`}`, `cube-${seat}`);
      } else if (r.extraTurn && snap.lastMove && this.seatIsLocal(snap.lastMove.seat)) {
        this.showBanner('Face complete — go again!', '');
      }
    }
  }

  private pushToRenderer(snap: SessionSnapshot): void {
    if (!this.renderer) return;
    this.renderer.update({
      state: snap.state,
      interactive: snap.interactive,
      analyses: snap.interactive ? analyzeAllMoves(snap.state) : undefined,
      lastMove: snap.lastMove,
    });
  }

  private seatIsLocal(seat: Seat): boolean {
    if (this.online) return seat === this.online.mySeat;
    return this.session.opts.mode === 'local' || seat === 0;
  }

  private showBanner(text: string, cls: string): void {
    this.banner = { text, cls };
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => (this.banner = null), 2200);
  }

  // ---- rendering ----

  render() {
    const snap = this.snap;
    return html`
      <div id="board"></div>
      ${snap ? this.renderHud(snap) : nothing}
      ${this.renderSlice()}
      ${this.hover && this.hoverEdge !== null ? this.renderChip(this.hover) : nothing}
      ${this.banner
        ? html`<div class="banner ${this.banner.cls}">${this.banner.text}</div>`
        : nothing}
      ${this.renderConnectionNotice()}
      ${snap && snap.state.status === 'finished' ? this.renderGameOver(snap) : nothing}
      <how-to-play .open=${this.helpOpen} @closed=${() => (this.helpOpen = false)}></how-to-play>
    `;
  }

  private renderHud(snap: SessionSnapshot) {
    const cubes = scores(snap.state);
    const faces = faceCounts(snap.state);
    const current = snap.state.currentSeat;
    return html`
      <div class="hud">
        <div class="players">
          ${([0, 1] as const).map(
            (seat) => html`
              <div class="player s${seat} ${current === seat ? '' : 'idle'}">
                <div class="name">
                  ${snap.playerNames[seat]}${this.online && !this.online.opponentConnected &&
                  seat !== this.online.mySeat
                    ? ' (away)'
                    : ''}
                </div>
                <div class="cubes seat-${seat}">${cubes[seat]}</div>
                <div class="faces">${faces[seat]} faces</div>
              </div>
            `,
          )}
        </div>
        <div class="turn">${this.turnText(snap)}</div>
        <div class="toolbar">
          <button class="btn" title="Slice the grid to see inside" @click=${this.cycleSlice}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill-rule="evenodd" d=${icons.layers} /></svg>
            ${this.sliceAxis === null ? 'Slice' : ['X', 'Y', 'Z'][this.sliceAxis]}
          </button>
          <button class="btn" title="Reset view" @click=${() => this.renderer?.resetView()}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill-rule="evenodd" d=${icons.camera} /></svg>
          </button>
          <button class="btn" title="How to play" @click=${() => (this.helpOpen = true)}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill-rule="evenodd" d=${icons.help} /></svg>
          </button>
          <button class="btn" @click=${this.exit}>New game</button>
        </div>
      </div>
    `;
  }

  private turnText(snap: SessionSnapshot): string {
    const seat = snap.state.currentSeat;
    if (snap.state.status !== 'playing') return 'Game over';
    if (this.online) return seat === this.online.mySeat ? 'Your turn' : `Waiting for ${snap.playerNames[seat]}…`;
    if (this.session.opts.mode === 'ai') return seat === 0 ? 'Your turn' : 'Computer is thinking…';
    return `${snap.playerNames[seat]}'s turn`;
  }

  private renderChip(a: MoveAnalysis) {
    return html`
      <div class="chip">
        <span class="dot" style="background:${CONSEQUENCE_COLORS[a.kind]}"></span>
        ${consequenceLabel(a)}
      </div>
    `;
  }

  private renderSlice() {
    if (this.sliceAxis === null) return nothing;
    const max = this.session.opts.gridSize - 2;
    return html`
      <div class="slice">
        <span class="muted">Layer</span>
        <input
          type="range"
          min="0"
          max=${max}
          .value=${String(this.sliceLayer)}
          @input=${(e: InputEvent) => this.setSliceLayer(Number((e.target as HTMLInputElement).value))}
          aria-label="Slice layer"
        />
        <span class="muted">${this.sliceLayer + 1}/${max + 1}</span>
      </div>
    `;
  }

  private renderConnectionNotice() {
    if (!this.online) return nothing;
    if (this.online.connection !== 'open') {
      return html`<div class="notice">Reconnecting…</div>`;
    }
    if (!this.online.opponentConnected) {
      return html`<div class="notice">Your opponent disconnected — they can rejoin anytime.</div>`;
    }
    return nothing;
  }

  private renderGameOver(snap: SessionSnapshot) {
    const [a, b] = scores(snap.state);
    const winner = snap.state.winner;
    const title =
      winner === null
        ? "It's a draw!"
        : this.online
          ? winner === this.online.mySeat
            ? 'You win!'
            : `${snap.playerNames[winner]} wins!`
          : `${snap.playerNames[winner]} wins!`;
    return html`
      <div class="overlay">
        <div class="card">
          <h2>${title}</h2>
          <div class="score-line">
            <span class="seat-0">${snap.playerNames[0]} — ${a}</span>
            &nbsp;·&nbsp;
            <span class="seat-1">${snap.playerNames[1]} — ${b}</span>
          </div>
          <p class="muted">cubes claimed</p>
          <button class="btn primary" @click=${this.exit}>Play again</button>
        </div>
      </div>
    `;
  }

  // ---- interactions ----

  private cycleSlice = () => {
    const order: (Axis | null)[] = [null, 0, 1, 2];
    const next = order[(order.indexOf(this.sliceAxis) + 1) % order.length]!;
    this.sliceAxis = next;
    this.sliceLayer = Math.min(this.sliceLayer, this.session.opts.gridSize - 2);
    this.renderer?.setSlice(next === null ? null : { axis: next, layer: this.sliceLayer });
  };

  private setSliceLayer(layer: number): void {
    this.sliceLayer = layer;
    if (this.sliceAxis !== null) this.renderer?.setSlice({ axis: this.sliceAxis, layer });
  }

  private exit = () => {
    this.dispatchEvent(new CustomEvent('exit', { bubbles: true, composed: true }));
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'game-screen': GameScreen;
  }
}
