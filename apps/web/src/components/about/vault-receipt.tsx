import Image from "next/image";

export const VaultReceipt = () => (
  <div className="relative mx-auto w-full max-w-lg">
    <div className="absolute -inset-5 -z-10 rounded-[2.5rem] bg-[#edf0ff] blur-2xl" />
    <div className="overflow-hidden rounded-[2rem] border border-[#d8dcef] bg-[#fafaff] text-[#171926] shadow-[0_28px_80px_rgba(35,40,85,0.13)]">
      <div className="flex items-center justify-between px-6 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <Image alt="" aria-hidden height={36} src="/icon.png" width={36} />
          <div>
            <span className="block text-sm font-semibold">Illustrative vault</span>
            <span className="font-mono text-[10px] tracking-wider text-[#777b94] uppercase">
              One target · one attempt
            </span>
          </div>
        </div>
        <span className="rounded-full bg-[#e2f4ea] px-3 py-1 font-mono text-[10px] font-semibold tracking-wider text-[#347050] uppercase">
          Funding
        </span>
      </div>

      <div className="border-y border-dashed border-[#d8dcef] px-6 py-7 sm:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="text-xs text-[#777b94]">Target</span>
            <strong className="mt-1 block text-3xl tracking-tight">way.eth</strong>
          </div>
          <div className="text-right">
            <span className="text-xs text-[#777b94]">Escrowed</span>
            <strong className="mt-1 block font-mono text-lg">8.40 ETH</strong>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <Contribution barClassName="w-[42%]" initials="A" label="Alice" value="3.50 ETH" />
          <Contribution barClassName="w-1/3" initials="B" label="Bob" value="2.80 ETH" />
          <Contribution barClassName="w-1/4" initials="C" label="Charlie" value="2.10 ETH" />
        </div>
      </div>

      <div className="px-6 py-6 sm:px-8">
        <span className="font-mono text-[10px] font-semibold tracking-[0.16em] text-[#777b94] uppercase">
          Purchase route
        </span>
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-center text-xs font-semibold">
          <span className="rounded-lg bg-[#edf0ff] px-2 py-3">Members</span>
          <span className="text-[#999db5]">→</span>
          <span className="rounded-lg bg-[#edf0ff] px-2 py-3">Escrow</span>
          <span className="text-[#999db5]">→</span>
          <span className="rounded-lg bg-[#171926] px-2 py-3 text-white">Group Safe</span>
        </div>
        <p className="mt-4 text-center text-xs leading-5 text-[#777b94]">
          ENS registers the name directly to the Safe. It never passes through an operator.
        </p>
      </div>
    </div>
  </div>
);

const Contribution = ({
  barClassName,
  initials,
  label,
  value,
}: {
  barClassName: string;
  initials: string;
  label: string;
  value: string;
}) => (
  <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3">
    <span className="flex size-8 items-center justify-center rounded-full bg-[#e7e9f5] font-mono text-[10px] font-semibold">
      {initials}
    </span>
    <div>
      <span className="block text-xs font-medium">{label}</span>
      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-[#e4e6f0]">
        <span className={`block h-full rounded-full bg-[#6974df] ${barClassName}`} />
      </span>
    </div>
    <span className="font-mono text-xs">{value}</span>
  </div>
);
