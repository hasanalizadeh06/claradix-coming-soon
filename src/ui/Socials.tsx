import { SITE, UI_REVEAL } from "@/lib/config";
import { track } from "@/lib/analytics";
import type { Copy } from "@/lib/copy";
import { reveal, revealDelay } from "@/lib/reveal";
import { Facebook, Instagram, LinkedIn } from "./icons";

/** From UI_REVEAL.sequence, not typed in again here. */
const LINK_STAGGER_MS = Math.round(
  (UI_REVEAL.sequence.find((s) => s.id === "socials")?.childStagger ?? 0) * 1000,
);

const LINKS = [
  { key: "linkedin", href: SITE.social.linkedin, label: "LinkedIn", Icon: LinkedIn },
  { key: "instagram", href: SITE.social.instagram, label: "Instagram", Icon: Instagram },
  { key: "facebook", href: SITE.social.facebook, label: "Facebook", Icon: Facebook },
] as const;

export function Socials({ copy, revealed }: { copy: Copy; revealed: boolean }) {
  return (
    <div className="socials">
      <span {...reveal("socials", revealed, "socials-label")}>{copy.followUs}</span>
      {LINKS.map(({ key, href, label, Icon }, index) => (
        <a
          key={key}
          // 60ms apart rather than together. Four identical circles arriving on
          // the same frame read as one wide object; arriving in sequence they
          // read as four things, which is what they are.
          {...reveal("socials", revealed, "social-link")}
          style={{
            ["--enter-delay" as string]:
              revealDelay("socials") + index * LINK_STAGGER_MS,
          }}
          href={href}
          aria-label={label}
          target="_blank"
          // noopener is a security requirement, noreferrer costs us the
          // referrer data we would want in analytics — so opener only.
          rel="noopener"
          onClick={() => track("social_click", { network: key })}
        >
          <Icon />
        </a>
      ))}
    </div>
  );
}
