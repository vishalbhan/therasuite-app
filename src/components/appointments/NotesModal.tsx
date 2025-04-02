import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrency } from '@/contexts/CurrencyContext';

interface NotesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  existingNotes?: string;
  callStartTime: Date | null;
  callEndTime: Date | null;
  currentPrice?: number;
  onSuccess?: () => void;
}

export function NotesModal({
  open,
  onOpenChange,
  appointmentId,
  existingNotes = "",
  callStartTime,
  callEndTime,
  currentPrice = 0,
  onSuccess,
}: NotesModalProps) {
  const [notes, setNotes] = useState(existingNotes);
  const [finalPrice, setFinalPrice] = useState(currentPrice.toString());
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { currency } = useCurrency();

  // Update notes and price when they change
  useEffect(() => {
    setNotes(existingNotes);
    setFinalPrice(currentPrice.toString());
  }, [existingNotes, currentPrice]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const { error } = await supabase
        .from("appointments")
        .update({ 
          notes,
          status: 'completed',
          price: parseFloat(finalPrice) || currentPrice // Use current price if parsing fails
        })
        .eq("id", appointmentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Session details saved successfully",
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to save session details",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate call duration
  const getCallDuration = () => {
    if (!callStartTime || !callEndTime) return 'N/A';
    const duration = Math.round((callEndTime.getTime() - callStartTime.getTime()) / 1000 / 60);
    return `${duration} minutes`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="mb-4">Session Notes</DialogTitle>
        </DialogHeader>

        {/* Add call timing details */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg text-sm">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="font-medium text-gray-500">Start Time</div>
              <div>{callStartTime ? format(callStartTime, 'h:mm a') : 'N/A'}</div>
            </div>
            <div>
              <div className="font-medium text-gray-500">End Time</div>
              <div>{callEndTime ? format(callEndTime, 'h:mm a') : 'N/A'}</div>
            </div>
            <div>
              <div className="font-medium text-gray-500">Duration</div>
              <div>{getCallDuration()}</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Add price input */}
          <div>
            <Label htmlFor="final-price">Final Price</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5">
                {currency === 'USD' ? '$' : 
                 currency === 'EUR' ? '€' : 
                 currency === 'GBP' ? '£' : 
                 currency === 'AUD' ? 'A$' : 
                 currency === 'CAD' ? 'C$' : 
                 '₹'}
              </span>
              <Input
                id="final-price"
                type="number"
                step="0.01"
                min="0"
                value={finalPrice}
                onChange={(e) => setFinalPrice(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>

          <Textarea
            placeholder="Enter your session notes here..."
            className="min-h-[200px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Notes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 