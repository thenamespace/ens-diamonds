import type { Metadata } from "next";
import Link from "next/link";
import { LegalTitle, P, Section, UL } from "../legal-ui";

export const metadata: Metadata = {
  title: "Terms of Service · ens.diamonds",
  description: "The terms that apply when you use the ens.diamonds interface.",
};

export default function TermsPage() {
  return (
    <article>
      <LegalTitle updated="20 July 2026">Terms of Service</LegalTitle>

      <Section title="1. Agreement">
        <P>
          These Terms of Service (the &ldquo;Terms&rdquo;) are an agreement between you and Namespace Inc., the company
          that operates ens.diamonds (the &ldquo;Operator&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). They apply to your use of the
          website at ens.diamonds and its subdomains (the &ldquo;Interface&rdquo;). By using the Interface you agree to
          these Terms. If you do not agree, do not use the Interface.
        </P>
      </Section>

      <Section title="2. What ens.diamonds is">
        <P>
          The Interface is a website that helps you interact with public, permissionless smart contracts on Ethereum:
          the CofferEscrow contract, the Ethereum Name Service (&ldquo;ENS&rdquo;) registration contracts, and Safe
          smart accounts. It lets individuals or groups deposit ETH into a shared vault to register expiring ENS names,
          and it displays information read from public blockchains and related services.
        </P>
        <P>
          The smart contracts are not the Interface. The escrow contract is <strong>immutable</strong>: it has no
          administrator, no pause switch, no upgrade path, and the Operator has no special access to it or to any funds
          in it. Anyone can interact with it directly, without this website. The Interface is one convenient way to do
          so, nothing more.
        </P>
      </Section>

      <Section title="3. Non-custodial. Your wallet, your keys">
        <P>
          We never hold, control, or have access to your funds, private keys, or seed phrase. Every transaction is
          composed locally in your wallet and signed by you. You alone are responsible for your wallet security, for
          reviewing every transaction before signing it, and for anything signed with your keys.
        </P>
      </Section>

      <Section title="4. How vaults work">
        <P>These mechanics are enforced by the escrow contract, not by us. In summary:</P>
        <UL>
          <li>
            Deposits toward a vault target are <strong>withdrawable in full at any time</strong> while the vault is
            funding.
          </li>
          <li>
            Once the target is reached, deposits lock for a <strong>24-hour execution window</strong> so the group can
            complete the ENS registration. If the window lapses without finalization, withdrawals open again.
          </li>
          <li>
            Finalization deploys a <strong>Safe smart account</strong> owned by the contributors, with a majority
            signature threshold. The registered name and any remaining funds are controlled by that Safe and its
            owners, not by the Operator.
          </li>
          <li>
            ENS registration is a public auction. <strong>Anyone in the world can register a name first</strong>, at
            any moment, including while a vault for it is funding. The contract cannot prevent this.
          </li>
        </UL>
        <P>
          The full rules live in the open-source contract code, which controls if this summary and the code ever
          disagree. See the <Link href="/legal/risks">Risk Disclosure</Link> before depositing anything.
        </P>
      </Section>

      <Section title="5. Fees and costs">
        <P>
          The Operator charges <strong>no fees</strong>. You pay Ethereum network gas for every transaction and the ENS
          protocol&rsquo;s registration price for names, both of which are set by systems outside our control and can
          change at any moment. Prices shown in the Interface are estimates for display only; the amounts enforced
          on-chain are authoritative.
        </P>
      </Section>

      <Section title="6. Eligibility and lawful use">
        <P>
          You may use the Interface only if you are of legal age where you live and only where doing so is lawful. You
          are solely responsible for complying with the laws, tax obligations, and sanctions rules that apply to you.
          The Interface is not offered to persons or entities subject to sanctions, or in jurisdictions where its use
          would be unlawful.
        </P>
      </Section>

      <Section title="7. No advice, no offer">
        <P>
          Nothing on the Interface is financial, investment, legal, or tax advice, and nothing here is an offer or
          solicitation to buy any asset. ENS names are not investments and their future value, if any, is unknowable.
          Decisions you make are yours alone.
        </P>
      </Section>

      <Section title="8. Third-party services">
        <P>
          The Interface depends on services we do not operate or control, including Ethereum itself, ENS, Safe, your
          wallet, RPC providers, the Resolvio resolution API, The Graph, and WalletConnect. We are not responsible for
          their availability, accuracy, or conduct, and information displayed in the Interface may be delayed or wrong
          because of them.
        </P>
      </Section>

      <Section title="9. Open source and intellectual property">
        <P>
          The ens.diamonds software is open source under the MIT license. The ens.diamonds name, logo, and visual
          identity remain the property of the Operator. You may not present a copy of the Interface in a way that
          suggests it is operated by us.
        </P>
      </Section>

      <Section title="10. Prohibited conduct">
        <UL>
          <li>Using the Interface for money laundering, sanctions evasion, fraud, or any other unlawful activity.</li>
          <li>Attacking, overloading, scraping at abusive volume, or interfering with the Interface or its APIs.</li>
          <li>Misrepresenting your affiliation with us, or operating phishing copies of the Interface.</li>
        </UL>
        <P>We may restrict access to the Interface at our discretion. The smart contracts remain public regardless.</P>
      </Section>

      <Section title="11. Disclaimers">
        <P>
          THE INTERFACE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo;, WITHOUT WARRANTIES OF ANY KIND,
          EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO
          NOT WARRANT THAT THE INTERFACE WILL BE AVAILABLE, ERROR-FREE, OR SECURE, THAT DISPLAYED DATA IS ACCURATE, OR
          THAT THE SMART CONTRACTS ARE FREE OF DEFECTS. THE ESCROW CONTRACT HAS BEEN AUDITED; AN AUDIT IS NOT A
          GUARANTEE.
        </P>
      </Section>

      <Section title="12. Limitation of liability">
        <P>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE OPERATOR AND ITS TEAM WILL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR EXEMPLARY DAMAGES, OR FOR ANY LOSS OF FUNDS, PROFITS, DATA, OR ENS
          NAMES, ARISING FROM YOUR USE OF THE INTERFACE OR THE UNDERLYING PROTOCOLS. THIS INCLUDES, WITHOUT LIMITATION,
          LOSSES FROM SMART-CONTRACT DEFECTS, NAMES REGISTERED BY THIRD PARTIES BEFORE A VAULT COMPLETES, ACTIONS OR
          INACTION OF VAULT CO-PARTICIPANTS, WALLET COMPROMISE, THIRD-PARTY SERVICE FAILURES, AND NETWORK CONDITIONS.
          WHERE LIABILITY CANNOT BE EXCLUDED, IT IS LIMITED TO 100 USD IN AGGREGATE.
        </P>
      </Section>

      <Section title="13. Indemnification">
        <P>
          You will indemnify and hold harmless the Operator and its team from claims, damages, and expenses (including
          reasonable legal fees) arising out of your use of the Interface, your transactions, or your violation of
          these Terms or applicable law.
        </P>
      </Section>

      <Section title="14. Changes and availability">
        <P>
          We may change, suspend, or discontinue the Interface, or update these Terms, at any time. The current Terms
          are always published on this page with their date. Your continued use of the Interface after a change means
          you accept the updated Terms.
        </P>
      </Section>

      <Section title="15. Severability and entire agreement">
        <P>
          If any provision of these Terms is found unenforceable, the remainder stays in effect. These Terms, together
          with the <Link href="/legal/privacy">Privacy Policy</Link> and{" "}
          <Link href="/legal/risks">Risk Disclosure</Link>, are the entire agreement between you and the Operator about
          the Interface.
        </P>
      </Section>

      <Section title="16. Contact">
        <P>
          ens.diamonds is built by the{" "}
          <a href="https://namespace.ninja" rel="noreferrer" target="_blank">
            Namespace
          </a>{" "}
          team. Questions about these Terms can be raised in the{" "}
          <a href="https://t.me/+2xzOUH_laAZhYTA6" rel="noreferrer" target="_blank">
            Namespace Telegram group
          </a>
          .
        </P>
      </Section>
    </article>
  );
}
