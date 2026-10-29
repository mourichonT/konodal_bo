import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

// Interrupteur (Base UI : rendu en <span role="switch">, jamais un bouton de
// soumission - utilisable dans un <form>).
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "inline-flex h-[26px] w-[46px] shrink-0 cursor-pointer items-center rounded-full p-[3px] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[checked]:bg-[oklch(40%_0.09_155)] data-[unchecked]:bg-[oklch(88%_0.008_150)] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-5 rounded-full bg-white shadow-[0_1px_3px_oklch(20%_0_0/0.25)] transition-transform data-[checked]:translate-x-5"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
