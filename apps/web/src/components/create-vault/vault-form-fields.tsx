"use client";

import { useCallback, useMemo, type ReactNode } from "react";

import {
  Description,
  FieldError,
  InputGroup,
  InfoIcon,
  Label,
  NumberField,
  NumberStepper,
  NumberValue,
  Switch,
  TextArea,
  TextField,
  Tooltip,
} from "@thenamespace/uikit";
import type { Control, UseFormGetValues } from "react-hook-form";
import { useController } from "react-hook-form";

import { parseEth } from "@/lib/helpers";

import type { VaultFormValues } from "./vault-form-types";

const USD_FORMAT_OPTIONS: Intl.NumberFormatOptions = {
  currency: "USD",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 2,
  style: "currency",
};
const MAX_SPEND_RULES = { validate: validatePositiveEth };
const ETH_FORMAT_OPTIONS = { maximumFractionDigits: 18, useGrouping: false } as const;

type FormFieldProps = {
  control: Control<VaultFormValues>;
};

export const MaximumSpendField = ({
  control,
  usdValue,
}: FormFieldProps & { usdValue: number | undefined }) => {
  const { field, fieldState } = useController({
    control,
    name: "maxSpend",
    rules: MAX_SPEND_RULES,
  });

  return (
    <EthAmountField
      description={
        usdValue === undefined ? null : (
          <>
            ≈ <NumberValue formatOptions={USD_FORMAT_OPTIONS} value={usdValue} />
          </>
        )
      }
      error={fieldState.error?.message}
      field={field}
      isInvalid={fieldState.invalid}
      label="Target amount"
      tooltip="The total ETH the group plans to raise and may spend on the name."
    />
  );
};

export const InitialContributionField = ({
  control,
  getValues,
}: FormFieldProps & { getValues: UseFormGetValues<VaultFormValues> }) => {
  const rules = useMemo(
    () => ({ validate: (value: string) => validateContribution(value, getValues("maxSpend")) }),
    [getValues],
  );
  const { field, fieldState } = useController({
    control,
    name: "initialContribution",
    rules,
  });

  return (
    <EthAmountField
      description={null}
      error={fieldState.error?.message}
      field={field}
      isInvalid={fieldState.invalid}
      label="Initial contribution"
      tooltip="ETH deposited by the creator in the vault creation transaction. This can be zero."
    />
  );
};

export const RegistrationDurationField = ({ control }: FormFieldProps) => {
  const { field } = useController({ control, name: "registrationYears" });

  return (
    <NumberStepper
      aria-label="Registration duration in years"
      className="w-full sm:w-60"
      maxValue={10}
      minValue={1}
      name={field.name}
      value={field.value}
      onChange={field.onChange}
    >
      <NumberStepper.Group className="w-full">
        <NumberStepper.DecrementButton aria-label="Decrease registration duration" />
        <NumberStepper.Value>
          {({ value }) => (
            <span className="number-stepper__value number-stepper__value--md flex-1 text-center">
              {value} {value === 1 ? "year" : "years"}
            </span>
          )}
        </NumberStepper.Value>
        <NumberStepper.IncrementButton aria-label="Increase registration duration" />
      </NumberStepper.Group>
    </NumberStepper>
  );
};

type EthAmountFieldProps = {
  description: ReactNode | null;
  error: string | undefined;
  field: ReturnType<typeof useController<VaultFormValues>>["field"];
  isInvalid: boolean;
  label: string;
  tooltip: string;
};

const EthAmountField = ({
  description,
  error,
  field,
  isInvalid,
  label,
  tooltip,
}: EthAmountFieldProps) => {
  const handleChange = useCallback(
    (value: number) => field.onChange(Number.isNaN(value) ? "" : String(value)),
    [field],
  );

  return (
    <NumberField
      isRequired
      className="min-w-0 w-full"
      formatOptions={ETH_FORMAT_OPTIONS}
      isInvalid={isInvalid}
      minValue={0}
      name={field.name}
      step={0.001}
      variant="secondary"
      value={field.value === "" ? Number.NaN : Number(field.value)}
      onBlur={field.onBlur}
      onChange={handleChange}
    >
      <FieldLabel label={label} tooltip={tooltip} />
      <NumberField.Group>
        <NumberField.DecrementButton aria-label={`Decrease ${label.toLowerCase()}`} />
        <NumberField.Input
          ref={field.ref}
          autoComplete="off"
          className="min-w-0 flex-1"
          inputMode="decimal"
          placeholder="0.00"
        />
        <span className="px-2 text-xs font-medium text-muted">ETH</span>
        <NumberField.IncrementButton aria-label={`Increase ${label.toLowerCase()}`} />
      </NumberField.Group>
      {error ? <FieldError>{error}</FieldError> : null}
      {description ? <Description>{description}</Description> : null}
    </NumberField>
  );
};

export const VaultMetadataFields = ({ control }: FormFieldProps) => {
  const name = useController({
    control,
    name: "vaultName",
    rules: {
      required: "Enter a public vault name.",
      maxLength: { value: 80, message: "Use 80 characters or fewer." },
    },
  });
  const description = useController({
    control,
    name: "description",
    rules: {
      required: "Enter a short description.",
      maxLength: { value: 500, message: "Use 500 characters or fewer." },
    },
  });
  return (
    <div className="space-y-5">
      <TextField
        isRequired
        isInvalid={name.fieldState.invalid}
        variant="secondary"
        value={name.field.value}
        onBlur={name.field.onBlur}
        onChange={name.field.onChange}
      >
        <FieldLabel
          label="Vault name"
          tooltip="A public title for this vault. It does not reveal the ENS name being targeted."
        />
        <InputGroup fullWidth>
          <InputGroup.Input
            ref={name.field.ref}
            maxLength={80}
            placeholder="Community name vault"
          />
        </InputGroup>
        {name.fieldState.error ? <FieldError>{name.fieldState.error.message}</FieldError> : null}
      </TextField>

      <TextField
        isRequired
        isInvalid={description.fieldState.invalid}
        variant="secondary"
        value={description.field.value}
        onBlur={description.field.onBlur}
        onChange={description.field.onChange}
      >
        <FieldLabel
          label="Description"
          tooltip="A public summary shown in vault discovery and metadata."
        />
        <TextArea
          ref={description.field.ref}
          className="min-h-20"
          maxLength={500}
          placeholder="Pooling ETH to acquire an ENS name together."
        />
        {description.fieldState.error ? (
          <FieldError>{description.fieldState.error.message}</FieldError>
        ) : null}
      </TextField>
    </div>
  );
};

export const VaultVisibilityField = ({ control }: FormFieldProps) => {
  const visibility = useController({ control, name: "isPublic" });

  return (
    <div>
      <Switch isSelected={visibility.field.value} onChange={visibility.field.onChange}>
        <Switch.Content>
          <span className="text-sm font-medium">List this vault publicly</span>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Content>
      </Switch>
      <Description>
        Public vaults appear in discovery using only this title and description. Acquisition secrets
        remain encrypted.
      </Description>
    </div>
  );
};

export const FieldLabel = ({ label, tooltip }: { label: string; tooltip: string }) => (
  <div className="flex items-center gap-1.5">
    <Label>{label}</Label>
    <Tooltip delay={200}>
      <Tooltip.Trigger aria-label={`About ${label}`} className="text-muted">
        <InfoIcon className="size-3.5" />
      </Tooltip.Trigger>
      <Tooltip.Content className="max-w-64">{tooltip}</Tooltip.Content>
    </Tooltip>
  </div>
);

const validateContribution = (value: string, maxSpend: string): true | string => {
  const amount = parseEth(value);
  if (amount === null || amount < 0n) return "Enter a valid ETH amount.";

  const cap = parseEth(maxSpend);
  if (cap !== null && amount > cap) return "Contribution cannot exceed maximum spend.";
  return true;
};

function validatePositiveEth(value: string): true | string {
  const amount = parseEth(value);
  if (amount === null || amount <= 0n) return "Enter an amount greater than 0 ETH.";
  return true;
}
