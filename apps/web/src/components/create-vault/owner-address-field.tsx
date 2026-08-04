"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, Chip, FieldError, InputGroup, Spinner, TextField } from "@thenamespace/uikit";
import { Cancel01Icon, Delete02Icon, HugeiconsIcon } from "@thenamespace/uikit/icons";
import type { Control, UseFormGetValues, UseFormTrigger } from "react-hook-form";
import { useController } from "react-hook-form";
import { useDebounceValue } from "usehooks-ts";
import { getAddress, isAddress, zeroAddress } from "viem";
import { normalize } from "viem/ens";

import { NameAvatar } from "@/components/common";
import { useEnsAddressRecord } from "@/hooks";

import { FieldLabel } from "./vault-form-fields";
import type { VaultFormValues } from "./vault-form-types";

type OwnerAddressFieldProps = {
  control: Control<VaultFormValues>;
  getValues: UseFormGetValues<VaultFormValues>;
  index: number;
  onRemove: (index: number) => void;
  trigger: UseFormTrigger<VaultFormValues>;
};

export const OwnerAddressField = ({
  control,
  getValues,
  index,
  onRemove,
  trigger,
}: OwnerAddressFieldProps) => {
  const [draft, setDraft] = useState("");
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [debouncedDraft] = useDebounceValue(draft, 400);
  const ensName = useMemo(
    () => (debouncedDraft === draft ? getEnsName(debouncedDraft) : null),
    [debouncedDraft, draft],
  );
  const resolution = useEnsAddressRecord(ensName);
  const rules = useMemo(
    () => ({ validate: (value: string) => validateOwner(value, index, getValues("owners")) }),
    [getValues, index],
  );
  const { field, fieldState } = useController({
    control,
    name: `owners.${index}.address`,
    rules,
  });

  useEffect(() => {
    if (!draft && !resolvedName && field.value) setDraft(field.value);
  }, [draft, field.value, resolvedName]);

  useEffect(() => {
    if (!ensName || !resolution.isSuccess) return;

    if (resolution.data) {
      if (resolvedName === ensName && field.value === resolution.data) return;
      field.onChange(resolution.data);
      setResolvedName(ensName);
      setInputError(null);
      queueMicrotask(() => void trigger(field.name));
      return;
    }

    field.onChange("");
    setInputError("This ENS name has no ETH address.");
  }, [ensName, field, resolution.data, resolution.isSuccess, resolvedName, trigger]);

  const updateDraft = useCallback(
    (value: string) => {
      setDraft(value);
      setResolvedName(null);
      setInputError(null);

      const candidate = value.trim();
      field.onChange(
        isAddress(candidate) && candidate !== zeroAddress ? getAddress(candidate) : "",
      );
    },
    [field],
  );
  const validateInput = useCallback(() => {
    field.onBlur();
    setInputError(getInputError(draft, resolution.isFetching));
    void trigger(field.name);
  }, [draft, field, resolution.isFetching, trigger]);
  const clearIdentity = useCallback(() => {
    setDraft("");
    setResolvedName(null);
    setInputError(null);
    field.onChange("");
    queueMicrotask(() => void trigger(field.name));
  }, [field, trigger]);
  const removeOwner = useCallback(() => onRemove(index), [index, onRemove]);
  const error = inputError ?? (resolution.isFetching ? undefined : fieldState.error?.message);

  return (
    <div className="flex items-end gap-2">
      <TextField
        isRequired
        className="min-w-0 flex-1"
        isInvalid={Boolean(error)}
        name={field.name}
        variant="secondary"
        value={resolvedName ? "" : draft}
        onBlur={validateInput}
        onChange={updateDraft}
      >
        <FieldLabel
          label={index === 0 ? "Creator" : `Owner ${index + 1}`}
          tooltip={
            index === 0
              ? "Defaults to the connected wallet and creates the vault."
              : "This address becomes an owner of the Safe created after purchase."
          }
        />
        <InputGroup fullWidth className="min-w-0">
          {resolvedName ? (
            <InputGroup.Prefix>
              <Chip size="sm" variant="soft">
                <NameAvatar className="size-5" label={resolvedName} />
                <Chip.Label>{resolvedName}</Chip.Label>
                <Button
                  isIconOnly
                  aria-label={`Clear ${resolvedName}`}
                  size="sm"
                  type="button"
                  variant="ghost"
                  onPress={clearIdentity}
                >
                  <HugeiconsIcon aria-hidden icon={Cancel01Icon} width={14} />
                </Button>
              </Chip>
            </InputGroup.Prefix>
          ) : null}
          <InputGroup.Input
            ref={field.ref}
            aria-label={resolvedName ? `${resolvedName} resolved address` : undefined}
            autoComplete="off"
            className="min-w-0 flex-1"
            placeholder={resolvedName ? "" : "vitalik.eth or 0x…"}
            readOnly={resolvedName !== null}
            spellCheck={false}
          />
          {resolution.isFetching ? (
            <InputGroup.Suffix>
              <Spinner aria-label="Resolving ENS name" size="sm" />
            </InputGroup.Suffix>
          ) : null}
        </InputGroup>
        {error ? <FieldError>{error}</FieldError> : null}
      </TextField>

      {index >= 2 ? (
        <Button
          isIconOnly
          aria-label={`Remove owner ${index + 1}`}
          size="md"
          type="button"
          variant="ghost"
          onPress={removeOwner}
        >
          <HugeiconsIcon aria-hidden icon={Delete02Icon} width={17} />
        </Button>
      ) : null}
    </div>
  );
};

const getEnsName = (value: string) => {
  const candidate = value.trim();
  if (!candidate.toLocaleLowerCase("en-US").endsWith(".eth")) return null;

  try {
    return normalize(candidate);
  } catch {
    return null;
  }
};

const getInputError = (value: string, isResolving: boolean) => {
  const candidate = value.trim();
  if (!candidate) return "Enter an address or ENS name.";
  if (isResolving) return null;
  if (isAddress(candidate)) {
    return getAddress(candidate) === zeroAddress ? "The zero address cannot own the Safe." : null;
  }
  if (candidate.toLocaleLowerCase("en-US").endsWith(".eth")) {
    return getEnsName(candidate) ? null : "Enter a valid ENS name.";
  }
  return "Enter an Ethereum address or .eth name.";
};

const validateOwner = (
  value: string,
  index: number,
  owners: VaultFormValues["owners"],
): true | string => {
  if (!isAddress(value)) return "Enter an address or ENS name.";
  if (getAddress(value) === zeroAddress) return "The zero address cannot own the Safe.";

  const normalized = getAddress(value);
  const duplicateIndex = owners.findIndex((owner, ownerIndex) => {
    if (ownerIndex === index || !isAddress(owner.address)) return false;
    return getAddress(owner.address) === normalized;
  });

  return duplicateIndex === -1 ? true : `Already added as owner ${duplicateIndex + 1}.`;
};
