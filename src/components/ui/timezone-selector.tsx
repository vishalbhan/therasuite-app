import React, { useState, useMemo } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { TIMEZONE_OPTIONS, searchTimezones, getTimezoneDisplayName } from '@/lib/timezone';

interface TimezoneSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function TimezoneSelector({
  value,
  onValueChange,
  placeholder = "Select timezone...",
  className
}: TimezoneSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTimezones = useMemo(() => {
    return searchTimezones(searchQuery);
  }, [searchQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {value ? getTimezoneDisplayName(value) : placeholder}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0 bg-white border shadow-md" align="start">
        <Command className="bg-white">
          <div className="flex items-center border-b px-3 bg-white" cmdk-input-wrapper="">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Search timezones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-white"
            />
          </div>
          <CommandList className="bg-white">
            <CommandEmpty className="bg-white text-gray-500 py-6 text-center">No timezone found.</CommandEmpty>
            <CommandGroup className="max-h-[300px] overflow-auto bg-white">
              {filteredTimezones.map((timezone) => (
                <CommandItem
                  key={timezone.value}
                  value={timezone.value}
                  onSelect={(currentValue) => {
                    onValueChange(currentValue === value ? "" : currentValue);
                    setOpen(false);
                    setSearchQuery('');
                  }}
                  className="cursor-pointer hover:bg-gray-100 px-3 py-2 bg-white"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === timezone.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900">{timezone.label}</span>
                    <span className="text-xs text-gray-500">{timezone.value}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
