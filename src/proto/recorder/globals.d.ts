interface Window {
  /** Injected by the shell into the srcdoc (see Frame.tsx). In dev the frame is loaded by URL and the nonce arrives as ?nonce=. */
  __WC_NONCE__?: string;
}
