import { normalize } from "viem/ens";

const MAX_LABEL_LENGTH = 255;

export function parseNameLabels(values: string[], maximum: number) {
  if (values.length === 0 || values.length > maximum) {
    throw new RangeError(`Between 1 and ${maximum} labels are required`);
  }

  return [
    ...new Set(
      values.map((value) => {
        const label = value.trim().replace(/\.eth$/iu, "");
        if (!label || label.length > MAX_LABEL_LENGTH || label.includes(".")) {
          throw new TypeError("Labels must be second-level .eth labels");
        }

        return normalize(`${label}.eth`).slice(0, -4);
      }),
    ),
  ];
}
