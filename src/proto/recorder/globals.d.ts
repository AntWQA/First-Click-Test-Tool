interface Window {
  /** Injected by the shell into the srcdoc (see Frame.tsx). In dev the frame is loaded by URL and the nonce arrives as ?nonce=. */
  __WC_NONCE__?: string;
  /** Injected by the shell: the page this task starts on (default "/"). In dev it arrives as ?start=. */
  __WC_START__?: string;
}
