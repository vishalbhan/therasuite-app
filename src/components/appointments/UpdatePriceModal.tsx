import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/hooks/use-toast";
import { useCurrency } from '@/contexts/CurrencyContext';

interface UpdatePriceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  currentPrice: number;
  onUpdate: () => void;
}

// Form content component
function PriceForm({
  price,
  setPrice,
  currency,
  handleSubmit,
  isSubmitting,
  className
}: {
  price: string;
  setPrice: (price: string) => void;
  currency: string;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  isSubmitting: boolean;
  className?: string;
}) {
  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="space-y-4">
        <div>
          <div className="relative">
            <span className="absolute left-3 top-2">
              {currency === 'USD' ? '$' : 
               currency === 'EUR' ? '€' : 
               currency === 'GBP' ? '£' : 
               currency === 'AUD' ? 'A$' : 
               currency === 'CAD' ? 'C$' : 
               '₹'}
            </span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="pl-7"
              placeholder="0.00"
            />
          </div>
        </div>
      </div>
    </form>
  );
}

export function UpdatePriceModal({
  open,
  onOpenChange,
  appointmentId,
  currentPrice,
  onUpdate
}: UpdatePriceModalProps) {
  const isMobile = useIsMobile();
  const [price, setPrice] = useState(currentPrice.toFixed(2));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { currency } = useCurrency();

  useEffect(() => {
    if (open) {
      setPrice(currentPrice.toFixed(2));
    }
  }, [open, currentPrice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ price: parseFloat(price) })
        .eq('id', appointmentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Price updated successfully",
      });

      onUpdate();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update price",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formProps = {
    price,
    setPrice,
    currency,
    handleSubmit,
    isSubmitting,
  };

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader className="mb-4">
            <DialogTitle>Update Session Price</DialogTitle>
          </DialogHeader>
          <PriceForm {...formProps} />
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} onClick={handleSubmit}>
              {isSubmitting ? "Updating..." : "Update Price"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Update Session Price</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-4">
          <PriceForm {...formProps} />
        </div>
        <DrawerFooter className="pt-2">
          <Button type="submit" disabled={isSubmitting} onClick={handleSubmit}>
            {isSubmitting ? "Updating..." : "Update Price"}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline" disabled={isSubmitting}>
              Cancel
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
} 