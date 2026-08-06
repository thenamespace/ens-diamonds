"use client";

import { Breadcrumbs, Typography } from "@thenamespace/uikit";

import { HomeAction, PageMain, PageState } from "@/components/common";
import { useEnsNameDetails } from "@/hooks";

import { VaultConfigurationForm } from "./vault-configuration-form";

type CreateVaultPageProps = {
  label: string;
};

export const CreateVaultPage = ({ label }: CreateVaultPageProps) => {
  const name = `${label}.eth`;
  const { isAvailable, isError } = useEnsNameDetails({ label });

  if (isAvailable === undefined) {
    return isError ? (
      <PageState
        description="ENS availability could not be verified. Refresh the page and try again."
        title="Couldn't Check Name Availability"
      >
        <HomeAction label="Browse Names" />
      </PageState>
    ) : (
      <PageState isLoading title={`Checking whether ${name} is available`} />
    );
  }

  if (!isAvailable) {
    return (
      <PageState
        description="A vault can only be created for a name that is available to register through ENS."
        title={`${name} Is Already Taken`}
      >
        <HomeAction label="Browse Names" />
      </PageState>
    );
  }

  return (
    <PageMain>
      <Breadcrumbs>
        <Breadcrumbs.Item href="/">Discover</Breadcrumbs.Item>
        <Breadcrumbs.Item href={`/name/${encodeURIComponent(name)}`}>{name}</Breadcrumbs.Item>
        <Breadcrumbs.Item>Start a vault</Breadcrumbs.Item>
      </Breadcrumbs>

      <header className="mt-8 max-w-3xl">
        <Typography.Heading
          className="wrap-break-word text-balance text-3xl tracking-tight sm:text-4xl"
          level={1}
        >
          Start a vault to buy {name}
        </Typography.Heading>
        <Typography.Paragraph className="mt-3 max-w-2xl" color="muted">
          Choose who will share the name, set the spending limit, and make your first contribution.
          These choices are fixed after the vault is created.
        </Typography.Paragraph>
      </header>

      <VaultConfigurationForm label={label} />
    </PageMain>
  );
};
