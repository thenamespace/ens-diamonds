import type { Metadata } from "next";
import { LegalTitle, P, Section, UL } from "../legal-ui";

export const metadata: Metadata = {
  title: "Privacy Policy · ens.diamonds",
  description: "What data ens.diamonds processes, and what it never collects.",
};

export default function PrivacyPage() {
  return (
    <article>
      <LegalTitle updated="20 July 2026">Privacy Policy</LegalTitle>

      <Section title="1. The short version">
        <P>
          ens.diamonds has no user accounts. We never ask for your name, email address, or any identity document, and
          we run no advertising or cross-site tracking. What we process is your public wallet address, the vault data
          you create, and the minimum technical data needed to keep the site running. Everything below is the complete
          list, written from the actual code.
        </P>
      </Section>

      <Section title="2. What we process">
        <UL>
          <li>
            <strong>Wallet address.</strong> When you connect a wallet, the Interface sees your public address. If you
            sign in (Sign-In with Ethereum), your signature is verified and your address is kept in an encrypted
            session cookie in your browser.
          </li>
          <li>
            <strong>Data you create.</strong> Favourited names, vault visibility settings, registration coordination
            data, and portfolio records are stored keyed by wallet address in a managed Redis database (Upstash), so
            they are there when you come back.
          </li>
          <li>
            <strong>IP address, transiently.</strong> Your IP is used for per-minute rate limiting to protect the site
            from abuse. Rate-limit counters expire automatically within minutes and are not used for anything else.
          </li>
          <li>
            <strong>Hosting logs.</strong> The site runs on Vercel, whose infrastructure keeps standard request logs
            (IP, URL, user agent) for a limited period, as any web host does.
          </li>
        </UL>
        <P>
          The Interface currently runs <strong>no analytics and no error-tracking service</strong>. If that changes,
          this policy will be updated first.
        </P>
      </Section>

      <Section title="3. Cookies">
        <P>
          The site sets a single, strictly necessary, encrypted session cookie when you sign in with your wallet. It
          contains your session and nothing else, is never used for tracking, and is deleted when you sign out or when
          it expires. There are no advertising or third-party cookies, which is why there is no cookie banner.
        </P>
      </Section>

      <Section title="4. Who else sees traffic">
        <P>
          To work, the Interface talks to services we do not operate. When it does, those services see the technical
          data any web request carries (such as your IP address), and where relevant the addresses or names being
          looked up:
        </P>
        <UL>
          <li>An Ethereum RPC provider, to read the blockchain and broadcast your transactions.</li>
          <li>Resolvio, to resolve ENS names and avatars (and the euc.li avatar image gateway).</li>
          <li>The Graph, to list expiring ENS names (queried from our servers, not your browser).</li>
          <li>WalletConnect, only if you connect a wallet through it.</li>
          <li>Vercel (hosting) and Upstash (database), as processors of the data described above.</li>
        </UL>
        <P>Each operates under its own privacy policy. We do not sell or rent any data to anyone.</P>
      </Section>

      <Section title="5. The blockchain is public">
        <P>
          Deposits, withdrawals, vault participation, and ENS registrations happen on Ethereum, a public and permanent
          ledger. That data is visible to everyone, forever, and is replicated worldwide.{" "}
          <strong>Nobody, including us, can edit or delete it.</strong> If your wallet address is ever linked to your
          identity elsewhere, your on-chain history could be too. Please weigh that before transacting.
        </P>
      </Section>

      <Section title="6. Retention">
        <P>
          Session cookies expire on their own. Rate-limit counters expire within minutes. Favourites, visibility
          settings, and portfolio records are kept so the product works across visits, and removals you make in the
          Interface (such as unfavouriting a name) take effect immediately.
        </P>
      </Section>

      <Section title="7. Your choices">
        <P>
          You can use most of the site without connecting a wallet at all. You can disconnect your wallet and sign out
          at any time, use a fresh address to avoid linking activity, and clear the session cookie in your browser. For
          anything else concerning your data, reach the team in the{" "}
          <a href="https://t.me/+2xzOUH_laAZhYTA6" rel="noreferrer" target="_blank">
            Namespace Telegram group
          </a>
          . Note that we cannot alter on-chain data (see section 5).
        </P>
      </Section>

      <Section title="8. Children">
        <P>The Interface is not directed at children and may not be used by anyone under the age of legal majority.</P>
      </Section>

      <Section title="9. Changes">
        <P>
          If this policy changes, the new version is published on this page with an updated date. Material changes, such
          as adding an analytics service, will be reflected here before they go live.
        </P>
      </Section>
    </article>
  );
}
