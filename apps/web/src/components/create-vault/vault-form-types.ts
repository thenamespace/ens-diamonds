export const CREATE_VAULT_FORM_ID = "create-vault-form";
export const MIN_OWNERS = 2;
export const MAX_OWNERS = 10;

export type VaultFormValues = {
  owners: Array<{ address: string }>;
  vaultName: string;
  description: string;
  isPublic: boolean;
  maxSpend: string;
  registrationYears: number;
  initialContribution: string;
};
