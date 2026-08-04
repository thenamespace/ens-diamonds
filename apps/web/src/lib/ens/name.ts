import { normalize } from "viem/ens";

export const getSecondLevelEthLabel = (name: string) => {
  if (!name.toLowerCase().endsWith(".eth")) return null;

  try {
    const normalizedName = normalize(name);
    const parts = normalizedName.split(".");

    return parts.length === 2 && parts[0] && parts[1] === "eth" ? parts[0] : null;
  } catch {
    return null;
  }
};
