"use client";

import { useMemo, type ReactNode } from "react";

import {
  Description,
  FieldError,
  InputGroup,
  InfoIcon,
  Label,
  NumberStepper,
  NumberValue,
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
      label="Maximum spend"
      tooltip="The most ETH this vault may raise or spend on the name."
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
}: EthAmountFieldProps) => (
  <TextField
    isRequired
    className="min-w-0 w-full"
    isInvalid={isInvalid}
    name={field.name}
    variant="secondary"
    value={String(field.value)}
    onBlur={field.onBlur}
    onChange={field.onChange}
  >
    <FieldLabel label={label} tooltip={tooltip} />
    <InputGroup fullWidth className="min-w-0">
      <InputGroup.Input ref={field.ref} autoComplete="off" inputMode="decimal" placeholder="0.00" />
      <InputGroup.Suffix>ETH</InputGroup.Suffix>
    </InputGroup>
    {error ? <FieldError>{error}</FieldError> : null}
    {description ? <Description>{description}</Description> : null}
  </TextField>
);

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
