import type { Metadata } from "next";
import { APP_CHAIN } from "@/lib/app-chain";
import { ESCROW_ADDRESS, isEscrowConfigured } from "@/lib/chain";
import { LegalTitle, P, Section, UL } from "../legal-ui";

export const metadata: Metadata = {
  title: "Risk Disclosure",
  description: "The risks of pooling ETH to register ENS names. Read this before depositing.",
  alternates: { canonical: "/legal/risks" },
};

export default function RisksPage() {
  return (
    <article>
      <LegalTitle updated="20 July 2026">Risk Disclosure</LegalTitle>

      <Section title="Read this before depositing">
        <P>
          ens.diamonds is a non-custodial interface to immutable smart contracts. That design removes some risks (we
          cannot touch your funds) and hardens others (nobody can hit pause if something goes wrong).{" "}
          <strong>You can lose everything you deposit.</strong> Only deposit what you can afford to lose.
        </P>
      </Section>

      <Section title="Smart contract risk">
        <P>
          The escrow contract
          {isEscrowConfigured ? (
            <>
              {" "}
              (
              <a
                className="font-mono text-[13px]"
                href={`${APP_CHAIN.explorerUrl}/address/${ESCROW_ADDRESS}`}
                rel="noreferrer"
                target="_blank"
              >
                {ESCROW_ADDRESS}
              </a>
              )
            </>
          ) : null}{" "}
          is open source. It has had an internal security review with all findings fixed, plus automated AI-driven
          scans from external tools; their reports are public in{" "}
          <a
            href="https://github.com/thenamespace/ens-diamonds/tree/main/docs/security"
            rel="noreferrer"
            target="_blank"
          >
            docs/security
          </a>
          . None of this is a substitute for a formal manual audit, which has not yet been performed. Smart contracts
          can contain undiscovered defects, and this
          one is <strong>immutable by design</strong>: no administrator, no pause switch, no upgrade path. If a defect
          is ever found, there is no one who can freeze the contract or recover funds. The same applies to the ENS and
          Safe contracts the flow depends on.
        </P>
      </Section>

      <Section title="Someone can buy the name first">
        <P>
          Expiring ENS names are sold in a public, permissionless auction where the premium decays over 21 days.{" "}
          <strong>Anyone in the world can register a name at any moment</strong>, including seconds before your vault
          finalizes. If that happens, the vault can no longer buy the name; deposits remain withdrawable, but your goal
          is gone and the gas you spent is not refunded. Waiting for a lower premium is a gamble against every other
          buyer watching the same name.
        </P>
      </Section>

      <Section title="Group vaults mean shared control">
        <P>
          When a vault finalizes, the name and any remaining ETH are controlled by a Safe smart account owned by all
          contributors, with a majority signature threshold. That means:
        </P>
        <UL>
          <li>
            <strong>You cannot act alone.</strong> Selling, transferring, or managing the name needs a majority of
            co-owners to sign.
          </li>
          <li>
            <strong>A majority can act without you.</strong> Co-owners holding the threshold can move the Safe&rsquo;s
            assets in ways you disagree with.
          </li>
          <li>
            <strong>Unresponsive co-owners can freeze the group.</strong> If too many owners lose keys or disappear,
            the Safe may be unable to reach its threshold, permanently.
          </li>
        </UL>
        <P>Join vaults only with people you have reason to trust.</P>
      </Section>

      <Section title="Timing locks">
        <P>
          Once a vault reaches its funding target, deposits are locked for a 24-hour execution window while the group
          completes the registration. During that window you cannot withdraw. If the window lapses without
          finalization, withdrawals open again.
        </P>
      </Section>

      <Section title="Wallets and keys">
        <P>
          Losing your private keys or seed phrase means losing access to your deposits, your Safe ownership, and your
          names. Nobody can reset or recover them. Signing a malicious transaction on a phishing site can drain your
          wallet. Always check that you are on <strong>ens.diamonds</strong> and review every transaction in your
          wallet before signing.
        </P>
      </Section>

      <Section title="Gas, congestion, and price display">
        <P>
          Ethereum fees are volatile and can spike exactly when you need to act, such as during a premium auction or an
          execution window. Prices and countdowns shown in the Interface are best-effort estimates read from public
          data; the blockchain&rsquo;s state at the moment your transaction lands is what actually applies.
        </P>
      </Section>

      <Section title="If this website goes down">
        <P>
          The Interface can be unavailable, but your funds do not live here. The escrow contract is public and anyone
          can interact with it directly, for example through a block explorer, to withdraw or finalize without this
          site. The contract address is in the footer of every page.
        </P>
      </Section>

      <Section title="Regulation and taxes">
        <P>
          The legal treatment of crypto-assets and jointly owned ENS names is uncertain and varies by country.
          Transactions may create tax obligations for you. You are responsible for knowing and following the rules
          where you live.
        </P>
      </Section>

      <Section title="No insurance, no advice">
        <P>
          Deposits are not bank deposits. They are not insured or guaranteed by anyone. Nothing on this site is
          financial, investment, legal, or tax advice, and ENS names have no assured value or resale market.
        </P>
      </Section>
    </article>
  );
}
