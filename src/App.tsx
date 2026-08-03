import { Fragment } from "react";
import { COPY } from "@/lib/copy";
import { SITE } from "@/lib/config";
import { reveal, useUiReveal } from "@/lib/reveal";
import { KineticHeadline } from "@/ui/KineticHeadline";
import { Countdown } from "@/ui/Countdown";
import { WhatsAppCta } from "@/ui/WhatsAppCta";
import { Socials } from "@/ui/Socials";
import { SceneCanvas } from "@/ui/SceneCanvas";

/**
 * The page shell.
 *
 * Composition rule: the left third of the frame belongs to type, the right two
 * thirds belong to the scene. The camera is aimed to respect that — the scene
 * was composed around the text, not dropped in behind it.
 *
 * The page has exactly one animation system now: `.enter`, which plays once on
 * load. Everything that repeats lives in the scene, behind the glass.
 */

function Lead({ text, accent }: { text: string; accent: string }) {
  const at = text.indexOf(accent);
  if (at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="accent">{accent}</span>
      {text.slice(at + accent.length)}
    </>
  );
}

function DottedList({ words }: { words: readonly string[] }) {
  return (
    <>
      {words.map((word, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="dot" aria-hidden="true" />}
          <span>{word}</span>
        </Fragment>
      ))}
    </>
  );
}

export function App() {
  // The whole page waits for the bridge. See lib/reveal.ts — including why it
  // is guaranteed to arrive even when the bridge never does.
  const revealed = useUiReveal();
  const at = (id: string, className?: string) => reveal(id, revealed, className);

  return (
    <>
      <SceneCanvas />
      <div className="scrim" aria-hidden="true" />

      <div className="page">
        <header className="masthead">
          <a {...at("logo", "logo")} href={SITE.url} aria-label={SITE.name}>
            <img
              src="/img/claradix-logo.png"
              alt="Claradix"
              width={132}
              height={85}
              decoding="async"
            />
          </a>

          <p {...at("tagline", "tagline-rail")}>
            <DottedList words={COPY.keywords.slice(0, 3)} />
          </p>
        </header>

        <main className="main">
          <div className="content">
            <p {...at("eyebrow", "eyebrow")}>{COPY.eyebrow}</p>

            <KineticHeadline revealed={revealed} />

            <p {...at("subheadline", "lead")}>
              <Lead text={COPY.lead} accent={COPY.leadAccent} />
            </p>

            <div {...at("cta")}>
              <WhatsAppCta copy={COPY} />
            </div>

            <Socials copy={COPY} revealed={revealed} />
          </div>

          <div {...at("countdown-ring", "aside")}>
            <Countdown copy={COPY} revealed={revealed} />
          </div>
        </main>

        <footer {...at("footer", "footer")}>
          <p className="footer-keywords">
            <DottedList words={COPY.keywords} />
          </p>
          <p className="footer-legal">
            © {new Date().getFullYear()} {SITE.legalName}
          </p>
        </footer>
      </div>
    </>
  );
}
