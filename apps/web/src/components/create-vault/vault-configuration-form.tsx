"use client";

import { useCallback, useEffect, useMemo } from "react";

import { useRouter } from "next/navigation";

import { Button, Card, Description, Fieldset, Form, Typography } from "@thenamespace/uikit";
import { Add01Icon, HugeiconsIcon, UserMultiple02Icon } from "@thenamespace/uikit/icons";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import type { Address } from "viem";
import { parseEther } from "viem";
import { useAccount } from "wagmi";

import { useCreateVault, useEthPrice } from "@/hooks";
import { SECONDS_PER_YEAR } from "@/lib/constants";
import { getMajorityThreshold } from "@/lib/helpers";

import { OwnerAddressField } from "./owner-address-field";
import {
  FieldLabel,
  InitialContributionField,
  MaximumSpendField,
  RegistrationDurationField,
  VaultMetadataFields,
} from "./vault-form-fields";
import { CREATE_VAULT_FORM_ID, MAX_OWNERS, type VaultFormValues } from "./vault-form-types";
import { VaultSidebar } from "./vault-sidebar";

const DEFAULT_VALUES: VaultFormValues = {
  owners: [{ address: "" }, { address: "" }],
  vaultName: "",
  description: "",
  isPublic: true,
  maxSpend: "",
  registrationYears: 1,
  initialContribution: "0",
};

type VaultConfigurationFormProps = {
  label: string;
};

export const VaultConfigurationForm = ({ label }: VaultConfigurationFormProps) => {
  const name = `${label}.eth`;
  const { address: connectedAddress } = useAccount();
  const router = useRouter();
  const createVault = useCreateVault();
  const form = useForm<VaultFormValues>({
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
    reValidateMode: "onChange",
  });
  const { control, formState, getValues, handleSubmit, reset, setValue, trigger } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "owners" });
  const [maxSpend, registrationYears, initialContribution, isPublic] = useWatch({
    control,
    name: ["maxSpend", "registrationYears", "initialContribution", "isPublic"],
  });
  const ethPrice = useEthPrice();

  const maxSpendUsd = useMemo(
    () => getUsdValue(maxSpend, ethPrice.data),
    [ethPrice.data, maxSpend],
  );
  const ownerCount = fields.length;
  const threshold = getMajorityThreshold(ownerCount);

  const addOwner = useCallback(() => append({ address: "" }, { shouldFocus: true }), [append]);
  const removeOwner = useCallback(
    (index: number) => {
      remove(index);
      void trigger("owners");
    },
    [remove, trigger],
  );
  const submitVault = handleSubmit(async (values) => {
    try {
      const result = await createVault.mutateAsync({
        initialContribution: parseEther(values.initialContribution),
        isPublic: values.isPublic,
        label,
        maxSpend: parseEther(values.maxSpend),
        metadata: {
          name: values.vaultName.trim(),
          description: values.description.trim(),
        },
        owners: values.owners.map(({ address }) => address as Address),
        registrationDuration: values.registrationYears * SECONDS_PER_YEAR,
      });

      reset({
        ...DEFAULT_VALUES,
        owners: [{ address: connectedAddress ?? "" }, { address: "" }],
      });
      router.push(`/vaults/${result.vaultId}`);
    } catch {
      // The mutation error is rendered in the summary card.
    }
  });

  useEffect(() => {
    if (formState.dirtyFields.initialContribution) void trigger("initialContribution");
  }, [formState.dirtyFields.initialContribution, maxSpend, trigger]);

  useEffect(() => {
    if (
      connectedAddress &&
      !formState.dirtyFields.owners?.[0]?.address &&
      !getValues("owners.0.address")
    ) {
      setValue("owners.0.address", connectedAddress, { shouldValidate: true });
    }
  }, [connectedAddress, formState.dirtyFields.owners, getValues, setValue]);

  return (
    <div className="mt-8 grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(22rem,2fr)]">
      <Form
        aria-label={`Create a vault for ${name}`}
        className="min-w-0"
        id={CREATE_VAULT_FORM_ID}
        validationBehavior="aria"
        onSubmit={submitVault}
      >
        <Card className="min-w-0" variant="default">
          <Card.Header>
            <Typography.Heading className="text-xl tracking-tight" level={2}>
              Vault configuration
            </Typography.Heading>
            <Card.Description>
              These settings cannot be changed after the vault is created.
            </Card.Description>
          </Card.Header>
          <Card.Content className="space-y-8">
            <VaultMetadataFields control={control} />

            <Fieldset>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Fieldset.Legend>Safe owners</Fieldset.Legend>
                  <Description>Add 2–10 unique addresses or ENS names.</Description>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                  <HugeiconsIcon aria-hidden icon={UserMultiple02Icon} width={16} />
                  {ownerCount}/{MAX_OWNERS}
                </div>
              </div>

              <Fieldset.Group className="gap-3">
                {fields.map((owner, index) => (
                  <OwnerAddressField
                    control={control}
                    getValues={getValues}
                    index={index}
                    key={owner.id}
                    onRemove={removeOwner}
                    trigger={trigger}
                  />
                ))}
              </Fieldset.Group>

              <Fieldset.Actions className="justify-start">
                <Button
                  isDisabled={ownerCount >= MAX_OWNERS}
                  size="sm"
                  type="button"
                  variant="secondary"
                  onPress={addOwner}
                >
                  <HugeiconsIcon aria-hidden icon={Add01Icon} width={16} />
                  Add owner
                </Button>
              </Fieldset.Actions>
            </Fieldset>

            <div className="grid gap-6 border-t border-default pt-8 sm:grid-cols-2">
              <MaximumSpendField control={control} usdValue={maxSpendUsd} />

              <InitialContributionField control={control} getValues={getValues} />
            </div>

            <div className="flex flex-col gap-4 border-t border-default pt-8 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <FieldLabel
                  label="Registration duration"
                  tooltip="How long the ENS name will be registered. Choose from 1 to 10 years."
                />
              </div>
              <RegistrationDurationField control={control} />
            </div>
          </Card.Content>
        </Card>
      </Form>

      <VaultSidebar
        error={createVault.error?.message}
        initialContribution={initialContribution}
        isConnected={Boolean(connectedAddress)}
        isPending={createVault.isPending}
        maxSpend={maxSpend}
        name={name}
        ownerCount={ownerCount}
        progress={createVault.progress}
        registrationYears={registrationYears}
        isPublic={isPublic}
        threshold={threshold}
      />
    </div>
  );
};

const getUsdValue = (eth: string | undefined, ethUsd: bigint | undefined) => {
  if (!eth || ethUsd === undefined) return undefined;
  const amount = Number(eth);
  if (!Number.isFinite(amount) || amount < 0) return undefined;
  return (amount * Number(ethUsd)) / 1e8;
};
