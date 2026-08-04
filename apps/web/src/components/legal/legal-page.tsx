import NextLink from "next/link";

import { Markdown, Typography } from "@thenamespace/uikit";

import { PageMain } from "@/components/common";

const legalNavigation = [
  { href: "/terms", label: "Terms", slug: "terms" },
  { href: "/privacy", label: "Privacy", slug: "privacy" },
  { href: "/risks", label: "Risks", slug: "risks" },
] as const;

type LegalPageProps = {
  content: string;
  lastUpdated: string;
  slug: (typeof legalNavigation)[number]["slug"];
  title: string;
};

export const LegalPage = ({ content, lastUpdated, slug, title }: LegalPageProps) => (
  <PageMain size="reading" spacing="loose">
    <nav aria-label="Legal documents" className="flex items-center gap-2 text-sm">
      {legalNavigation.map((item, index) => (
        <span className="flex items-center gap-2" key={item.slug}>
          {index > 0 ? <span className="text-muted/50">·</span> : null}
          <NextLink
            aria-current={item.slug === slug ? "page" : undefined}
            className={
              item.slug === slug
                ? "font-semibold text-foreground"
                : "font-medium text-muted transition-colors hover:text-foreground"
            }
            href={item.href}
          >
            {item.label}
          </NextLink>
        </span>
      ))}
    </nav>

    <header className="mt-12 border-b border-default pb-9">
      <Typography.Heading className="text-balance text-4xl tracking-tight sm:text-5xl" level={1}>
        {title}
      </Typography.Heading>
      <Typography.Paragraph className="mt-5" color="muted">
        Last updated: {lastUpdated}
      </Typography.Paragraph>
    </header>

    <Markdown
      className="mt-10 text-muted [&_a]:font-medium [&_blockquote]:my-6 [&_blockquote]:rounded-r-xl [&_blockquote]:border-l-4 [&_blockquote]:bg-default/50 [&_blockquote]:px-5 [&_blockquote]:py-4 [&_blockquote]:not-italic [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:text-xl [&_h2]:tracking-tight [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-base [&_li]:text-base [&_li]:leading-7 [&_ol]:space-y-2 [&_p]:mb-4 [&_p]:text-base [&_p]:leading-7 [&_strong]:font-semibold [&_strong]:text-foreground [&_table]:my-6 [&_table]:block [&_table]:overflow-x-auto [&_table]:text-sm [&_ul]:space-y-2"
      id={`legal-${slug}`}
    >
      {content}
    </Markdown>
  </PageMain>
);
