import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useCurrency } from '@/contexts/CurrencyContext';

interface UpdatePriceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  currentPrice: number;
  onUpdate: () => void;
}

export function UpdatePriceModal({
  open,
  onOpenChange,
  appointmentId,
  currentPrice,
  onUpdate
}: UpdatePriceModalProps) {
  const [price, setPrice] = useState(currentPrice.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { currency } = useCurrency();

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="mb-4">
          <DialogTitle>Update Session Price</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update Price"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 