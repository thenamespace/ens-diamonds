// FAQ copy. Rendered verbatim on /faq and serialized into FAQPage JSON-LD, so
// keep answers plain text. House style: no em dashes, "vault" not "pool".
export type FaqItem = { q: string; a: string };

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "What is ens.diamonds?",
    a: "ens.diamonds is an app for buying premium ENS names together. A group pools ETH into a shared vault, funds sit in an audited escrow contract, and the name is registered to a Safe multisig that all contributors control. You can also use it to buy a name solo.",
  },
  {
    q: "What is the ENS temporary premium?",
    a: "When a .eth name expires and its 90-day grace period passes, ENS puts it through a 21-day Dutch auction called the temporary premium. The premium starts near 100 million dollars and halves roughly every day until it reaches zero on day 21, added on top of the standard yearly registration fee. Desirable names get bought partway down the curve, before the price hits zero.",
  },
  {
    q: "How does buying a name together work?",
    a: "Someone creates a vault for a specific name and sets a funding target. Contributors deposit ETH into the escrow contract. Once the target is reached, the group moves the funds to a freshly deployed Safe multisig, and the name is registered directly to that Safe. Each contributor's share is recorded onchain in proportion to what they put in.",
  },
  {
    q: "Can I get my ETH back?",
    a: "Yes. While a vault is funding, you can withdraw your full deposit at any time without anyone's permission. Refunds are unilateral by design: the escrow contract lets you exit even if every other contributor disagrees. If a vault expires without reaching its target, everyone withdraws their deposits.",
  },
  {
    q: "Who owns the name after it is bought?",
    a: "A Safe multisig whose signers are the vault's contributors. No single person can transfer, sell, or change the name without reaching the signature threshold the group agreed on.",
  },
  {
    q: "Is ens.diamonds audited?",
    a: "The escrow contract's source code is published and verified on Etherscan, and it received an external audit. The one finding from that audit was fixed in escrow v2, which is the version live on mainnet today. The retired v1 contract held zero ETH at retirement.",
  },
  {
    q: "What does ens.diamonds cost?",
    a: "ens.diamonds charges no protocol fee. You pay the ENS registration price (the standard yearly fee plus any temporary premium), Ethereum gas, and the gas to deploy the group's Safe.",
  },
  {
    q: "Can I buy a name by myself?",
    a: "Yes. Every name page has a solo buy flow that registers the name directly to your wallet, premium and all, without creating a vault.",
  },
  {
    q: "What happens if a vault never fills?",
    a: "If the funding deadline passes before the target is reached, the vault expires. No purchase happens and every contributor withdraws their full deposit from the escrow.",
  },
  {
    q: "Which network does ens.diamonds run on?",
    a: "The live app runs on Ethereum mainnet at www.ens.diamonds. A separate Sepolia testnet deployment exists for trying the full flow with free test names.",
  },
];
