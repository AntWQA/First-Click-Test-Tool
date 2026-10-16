import { Component } from "react";
import type { ReactNode } from "react";

/** A record that cannot be drawn must never leave a blank page: say so, and offer the way back. Saved data is untouched. */
export class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="m-page">
        <h1>Something went wrong on this screen</h1>
        <p className="m-lede">Your sessions are saved and nothing has been lost. Reload the page to carry on. If it happens again on the same session, download a backup from the Sessions list and report it.</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
      </main>
    );
  }
}

