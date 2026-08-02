import { useId, useRef, useState, type FormEvent } from "react";
import { SITE, SUBSCRIBE_ENDPOINT } from "@/lib/config";
import { track } from "@/lib/analytics";
import type { Copy } from "@/lib/copy";
import { ArrowRight, Check, Spinner } from "./icons";

/**
 * Email capture — the one conversion this page has.
 *
 * Deliberate choices:
 *   - No endpoint configured means no fake success. The form hands off to a
 *     mailto: instead, which actually reaches somebody.
 *   - Validation is permissive. Rejecting a valid address to satisfy a regex
 *     costs a lead; a bad address costs one bounce.
 *   - The honeypot is off-screen rather than display:none, because a good share
 *     of bots skip fields that are display:none and fill the rest.
 */

type State = "idle" | "invalid" | "submitting" | "success" | "error";

// Intentionally loose: something, an @, something, a dot, something.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface Props {
  copy: Copy;
}

export function SubscribeForm({ copy }: Props) {
  const [state, setState] = useState<State>("idle");
  const [email, setEmail] = useState("");
  const honeypot = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const messageId = useId();

  const busy = state === "submitting";
  const done = state === "success";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || done) return;

    if (honeypot.current?.value) {
      // Silently accept, so the bot does not learn what tripped it.
      setState("success");
      return;
    }

    const value = email.trim();
    if (!EMAIL.test(value)) {
      setState("invalid");
      return;
    }

    track("subscribe_submit");

    if (!SUBSCRIBE_ENDPOINT) {
      window.location.href = `mailto:${SITE.email}?subject=${encodeURIComponent(
        "Notify me when Claradix launches",
      )}&body=${encodeURIComponent(value)}`;
      setState("success");
      return;
    }

    setState("submitting");
    try {
      const response = await fetch(SUBSCRIBE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, locale: "en", source: "coming-soon" }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setState("success");
      track("subscribe_success");
    } catch {
      setState("error");
      track("subscribe_error");
    }
  }

  const message =
    state === "invalid"
      ? copy.emailInvalid
      : state === "success"
        ? copy.success
        : state === "error"
          ? copy.failure
          : "";

  const tone =
    state === "success" ? "success" : state === "idle" ? "neutral" : "error";

  return (
    <form className="subscribe" onSubmit={handleSubmit} noValidate>
      <label className="sr-only" htmlFor={inputId}>
        {copy.ctaLabel}
      </label>
      <div
        className="subscribe-row"
        data-state={state === "invalid" ? "invalid" : undefined}
      >
        <input
          id={inputId}
          className="subscribe-input"
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          placeholder={copy.emailPlaceholder}
          value={email}
          disabled={done}
          aria-describedby={message ? messageId : undefined}
          aria-invalid={state === "invalid" || state === "error"}
          onChange={(event) => {
            setEmail(event.target.value);
            if (state === "invalid" || state === "error") setState("idle");
          }}
        />

        {/* Bot bait. Never focusable, never announced. */}
        <input
          ref={honeypot}
          className="honeypot"
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        <button
          className="subscribe-submit"
          type="submit"
          data-busy={busy}
          disabled={busy || done}
          aria-label={busy ? copy.submitting : copy.ctaLabel}
        >
          {done ? <Check /> : busy ? <Spinner /> : <ArrowRight />}
        </button>
      </div>
      <span
        id={messageId}
        className="subscribe-message"
        data-tone={tone}
        role="status"
        aria-live="polite"
      >
        {message}
      </span>
    </form>
  );
}
