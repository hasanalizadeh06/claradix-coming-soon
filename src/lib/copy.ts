/**
 * Page copy. English only.
 *
 * An earlier version alternated the headline between English and Azerbaijani as
 * an animation. It was dropped: a headline that rewrites itself every few
 * seconds competes with the scene for the one thing the visitor is trying to do
 * on this page, which is read one sentence. One language, stated once, holds
 * still — and the extended Latin font subset that Azerbaijani needed goes with
 * it, which is 34KB the page no longer downloads.
 */

export interface Copy {
  eyebrow: string;
  headline: [string, string];
  lead: string;
  /** Word inside `lead` that receives the accent colour. */
  leadAccent: string;
  ctaLabel: string;
  whatsappLabel: string;
  emailPlaceholder: string;
  emailInvalid: string;
  submitting: string;
  success: string;
  failure: string;
  followUs: string;
  countdown: [string, string, string, string];
  buildStatus: string;
  keywords: [string, string, string, string];
  /** Used for the document description and the accessible headline label. */
  documentSummary: string;
}

export const COPY: Copy = {
  eyebrow: "Coming soon",
  headline: ["Something new", "is taking shape."],
  lead: "Claradix is the bridge between your idea and reality.",
  leadAccent: "bridge",
  ctaLabel: "Get notified",
  whatsappLabel: "Contact us on WhatsApp",
  emailPlaceholder: "you@company.com",
  emailInvalid: "That address doesn't look right.",
  submitting: "Sending",
  success: "You're on the list.",
  failure: "Something went wrong. Try again, or email us directly.",
  followUs: "Follow us",
  countdown: ["Days", "Hours", "Minutes", "Seconds"],
  buildStatus: "Building",
  keywords: ["Innovation", "Speed", "Reliability", "You"],
  documentSummary:
    "Something new is taking shape. Claradix is the bridge between your idea and reality.",
};
