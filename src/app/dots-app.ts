import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

/** Root application shell. Placeholder until the UI phase lands. */
@customElement('dots-app')
export class DotsApp extends LitElement {
  static styles = css`
    :host {
      display: grid;
      place-items: center;
      height: 100%;
      color: var(--text-dim);
    }
  `;

  render() {
    return html`<p>Dots 3D — rewrite in progress</p>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dots-app': DotsApp;
  }
}
