import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProductCombobox({ products, value, onSelect, testid }) {
  const [open, setOpen] = useState(false);
  const selected = products.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          data-testid={testid}
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-white px-3 text-sm text-left"
        >
          <span className={cn("truncate", !selected && "text-slate-400")}>
            {selected ? selected.nama_produk : "Pilih produk"}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 bg-white w-[--radix-popover-trigger-width] min-w-[240px]" align="start">
        <Command>
          <CommandInput placeholder="Cari barang..." data-testid={`${testid}-search`} />
          <CommandList>
            <CommandEmpty>Barang tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.nama_produk}
                  onSelect={() => { onSelect(p.id); setOpen(false); }}
                  data-testid={`combobox-option-${p.id}`}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{p.nama_produk}</span>
                  <span className="ml-auto text-xs text-slate-400">stok {p.stock}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
