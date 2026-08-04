import { Accordion, Typography } from "@thenamespace/uikit";

const faqs = [
  {
    question: "What is ENS Diamonds?",
    answer:
      "An immutable escrow contract and interface for a fixed group to fund one attempt to register one second-level .eth name. If the attempt succeeds, the group’s Safe owns the name.",
  },
  {
    question: "Which names is it for?",
    answer:
      "It is designed for .eth names available through the ENS Controller, including expired names in the temporary premium period. ENS must report the name available when purchase executes.",
  },
  {
    question: "Can I use it alone?",
    answer:
      "No. A vault requires at least two distinct Safe owners and allows at most ten. With two owners, both signatures are required because the Safe uses a strict-majority threshold.",
  },
  {
    question: "Can I withdraw my contribution?",
    answer:
      "Yes, while the vault is in Funding. Once acquisition begins, withdrawals pause until the attempt succeeds or its ENS commitment expires.",
  },
  {
    question: "Does the vault need to reach maxSpend?",
    answer:
      "No. maxSpend is a cap, not a funding target. The creator may begin acquisition with any positive escrow, so members should verify the funded amount first.",
  },
  {
    question: "Who owns the name after purchase?",
    answer:
      "The deterministic Safe configured when the vault was created. ENS Diamonds never becomes the registrant. The Safe owners govern records, renewals, transfers, and later Safe configuration.",
  },
  {
    question: "What if the attempt fails?",
    answer:
      "After the commitment expires, the vault becomes Failed and members claim their recorded contributions. A retry requires a new vault, commitment, and predicted Safe.",
  },
  {
    question: "What does it cost?",
    answer:
      "The reviewed contract charges no protocol fee. Users still pay ENS registration and temporary premium pricing, Ethereum gas, and future renewal or Safe transaction costs.",
  },
] as const;

export const AboutFaq = () => (
  <section className="border-t border-default">
    <div className="mx-auto w-full max-w-4xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="text-center">
        <Typography.Paragraph
          className="font-mono text-xs font-semibold tracking-[0.18em] uppercase"
          color="muted"
        >
          Common questions
        </Typography.Paragraph>
        <Typography.Heading className="mt-5 text-balance text-4xl tracking-tight" level={2}>
          The short version
        </Typography.Heading>
      </div>

      <Accordion className="mt-12 border-y border-default" variant="default">
        {faqs.map((faq) => (
          <Accordion.Item id={faq.question} key={faq.question}>
            <Accordion.Heading>
              <Accordion.Trigger>
                <span className="text-left font-semibold">{faq.question}</span>
                <Accordion.Indicator />
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body className="max-w-3xl pb-6 leading-7 text-muted">
                {faq.answer}
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </div>
  </section>
);
