import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './setup-screen.ts';
import './game-screen.ts';
import './how-to-play.ts';
import { GameSession } from './session.ts';
import {
  NetClient,
  createRoom,
  getRoomInfo,
  playerToken,
  rememberRoom,
  recallRoomName,
  type ConnectionStatus,
} from '../net/client.ts';
import type { ServerMessage } from '../protocol/messages.ts';
import type { StartDetail, InviteInfo } from './setup-screen.ts';
import type { Seat } from '../engine/game.ts';
import type { GridSize } from '../engine/lattice.ts';
import { PLAYER_DEFAULT_NAMES } from './theme.ts';

type Screen = 'setup' | 'game';

/**
 * Application shell: navigation between setup and game, and the online
 * session lifecycle (room creation, invitations via ?room=, reconnection).
 * All server messages funnel through one handler into the GameSession.
 */
@customElement('dots-app')
export class DotsApp extends LitElement {
  @state() private screen: Screen = 'setup';
  @state() private session: GameSession | null = null;
  @state() private invite: InviteInfo | null = null;
  @state() private shareUrl: string | null = null;
  @state() private busyText = '';
  @state() private errorText = '';
  @state() private mySeat: Seat = 0;
  @state() private opponentConnected = true;
  @state() private connection: ConnectionStatus = 'open';

  private net: NetClient | null = null;
  private roomId: string | null = null;
  private onlineNames: [string, string] = ['Player 1', 'Player 2'];
  private myName = 'Player';
  private gridSize: GridSize = 4;
  private autoplay = true;

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    const roomId = new URLSearchParams(location.search).get('room');
    if (roomId) void this.loadInvite(roomId.toUpperCase());
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.teardown();
  }

  render() {
    if (this.screen === 'game' && this.session) {
      return html`<game-screen
        .session=${this.session}
        .online=${this.net
          ? {
              mySeat: this.mySeat,
              opponentConnected: this.opponentConnected,
              connection: this.connection,
            }
          : null}
        @exit=${this.onExit}
        @send-view=${(ev: CustomEvent) => this.net?.sendView(ev.detail)}
        @send-hover=${(ev: CustomEvent) => this.net?.sendHover(ev.detail.edgeId)}
      ></game-screen>`;
    }
    return html`<setup-screen
      .invite=${this.invite}
      .shareUrl=${this.shareUrl}
      .busyText=${this.busyText}
      .errorText=${this.errorText}
      @start=${this.onStartOffline}
      @create-online=${this.onCreateOnline}
      @join-online=${this.onJoinOnline}
      @decline-invite=${this.onDeclineInvite}
      @cancel-online=${this.onExit}
    ></setup-screen>`;
  }

  // ---- offline modes ----

  private onStartOffline = (ev: CustomEvent<StartDetail>) => {
    const d = ev.detail;
    this.session = new GameSession({
      mode: d.mode === 'ai' ? 'ai' : 'local',
      gridSize: d.gridSize,
      playerNames: d.names,
      aiDifficulty: d.difficulty,
      autoplayChains: d.autoplay,
    });
    this.screen = 'game';
  };

  // ---- online: create & wait ----

  private onCreateOnline = async (ev: CustomEvent<StartDetail>) => {
    const d = ev.detail;
    this.myName = d.names[0];
    this.gridSize = d.gridSize;
    this.autoplay = d.autoplay;
    this.busyText = 'Creating game…';
    this.errorText = '';
    try {
      this.roomId = await createRoom(d.gridSize);
    } catch {
      this.busyText = '';
      this.errorText = 'Could not reach the game server. Try again in a moment.';
      return;
    }
    history.replaceState(null, '', `?room=${this.roomId}`);
    rememberRoom(this.roomId, this.myName);
    this.connect();
    this.busyText = '';
    this.shareUrl = `${location.origin}${location.pathname}?room=${this.roomId}`;
  };

  // ---- online: invitation ----

  private async loadInvite(roomId: string): Promise<void> {
    this.busyText = 'Looking up the game…';
    const info = await getRoomInfo(roomId).catch(() => null);
    this.busyText = '';
    if (!info) {
      this.errorText = 'That game link is no longer valid.';
      history.replaceState(null, '', location.pathname);
      return;
    }
    this.roomId = roomId;
    this.gridSize = info.config.gridSize;

    // a room we already hold a seat in (host reload, guest reconnect):
    // skip the invitation and rejoin directly
    const knownName = recallRoomName(roomId);
    if (knownName) {
      this.myName = knownName;
      this.busyText = 'Rejoining game…';
      this.connect();
      return;
    }

    this.invite = {
      roomId,
      hostName: info.players[0]?.name ?? 'A friend',
      gridSize: info.config.gridSize,
      inProgress: info.seq > 0,
    };
  }

  private onJoinOnline = (ev: CustomEvent<{ name: string }>) => {
    this.myName = ev.detail.name;
    if (this.roomId) rememberRoom(this.roomId, this.myName);
    this.invite = null;
    this.busyText = 'Joining game…';
    this.connect();
  };

  private onDeclineInvite = () => {
    this.invite = null;
    this.roomId = null;
    history.replaceState(null, '', location.pathname);
  };

  // ---- online: connection & message handling ----

  private connect(): void {
    if (!this.roomId) return;
    this.net?.dispose();
    this.net = new NetClient({
      roomId: this.roomId,
      token: playerToken(),
      name: this.myName,
      onMessage: (msg) => this.onServerMessage(msg),
      onStatus: (status) => {
        this.connection = status;
      },
    });
    this.net.connect();
  }

  private onServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'joined': {
        if (msg.seat === null) {
          this.teardown();
          this.errorText = 'That game already has two players.';
          this.busyText = '';
          this.shareUrl = null;
          return;
        }
        this.mySeat = msg.seat;
        for (const p of msg.players) this.onlineNames[p.seat] = p.name;
        this.opponentConnected =
          msg.players.find((p) => p.seat !== msg.seat)?.connected ?? false;
        const bothSeated = msg.players.length === 2;
        this.ensureOnlineSession(msg.moves, bothSeated);
        return;
      }
      case 'player-joined': {
        if (msg.player.seat === this.mySeat) return; // never treat ourselves as the opponent
        this.onlineNames[msg.player.seat] = msg.player.name;
        this.opponentConnected = true;
        this.ensureOnlineSession([], true);
        this.session?.setPlayerNames([...this.onlineNames]);
        return;
      }
      case 'player-connection': {
        if (msg.seat !== this.mySeat) {
          this.opponentConnected = msg.connected;
          // realign a (re)connecting opponent with our camera if we control it
          if (msg.connected) this.gameScreen()?.resendView();
        }
        return;
      }
      case 'move-applied':
        this.session?.applyRemoteMove(msg.seq, msg.edgeId, msg.seat);
        return;
      case 'moves':
        this.session?.applyRemoteMoves(msg.from, msg.edgeIds);
        return;
      case 'view':
        this.gameScreen()?.applyRemoteView(msg);
        return;
      case 'hover':
        this.gameScreen()?.applyRemoteHover(msg.edgeId);
        return;
      case 'error':
        if (msg.code === 'not-your-turn' || msg.code === 'invalid-move') return; // benign race
        this.errorText = msg.message;
        return;
      case 'pong':
        return;
    }
  }

  private ensureOnlineSession(moves: number[], bothSeated: boolean): void {
    if (!this.session || this.session.opts.mode !== 'online') {
      this.session?.dispose();
      this.session = new GameSession({
        mode: 'online',
        gridSize: this.gridSize,
        playerNames: [
          this.onlineNames[0] ?? PLAYER_DEFAULT_NAMES[0],
          this.onlineNames[1] ?? PLAYER_DEFAULT_NAMES[1],
        ],
        mySeat: this.mySeat,
        autoplayChains: this.autoplay,
        transport: {
          sendMove: (seq, edgeId) => this.net?.sendMove(seq, edgeId),
          resync: (from) => this.net?.resync(from),
        },
      });
    }
    this.session.setPlayerNames([...this.onlineNames]);
    if (moves.length > 0) this.session.loadLog(moves);
    if (bothSeated) {
      this.busyText = '';
      this.shareUrl = null;
      this.screen = 'game';
    } else {
      // seated but alone (fresh room, or the host reloaded the waiting
      // tab): show the waiting room with the shareable link
      this.busyText = '';
      this.shareUrl = `${location.origin}${location.pathname}?room=${this.roomId}`;
      this.screen = 'setup';
    }
  }

  private gameScreen(): import('./game-screen.ts').GameScreen | null {
    return this.shadowRoot?.querySelector('game-screen') ?? null;
  }

  // ---- teardown ----

  private onExit = () => {
    this.teardown();
    this.screen = 'setup';
    history.replaceState(null, '', location.pathname);
  };

  private teardown(): void {
    this.net?.dispose();
    this.net = null;
    this.session?.dispose();
    this.session = null;
    this.roomId = null;
    this.shareUrl = null;
    this.invite = null;
    this.errorText = '';
    this.busyText = '';
    this.onlineNames = ['Player 1', 'Player 2'];
    this.opponentConnected = true;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dots-app': DotsApp;
  }
}
