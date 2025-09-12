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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrency } from '@/contexts/CurrencyContext';
import { encryptSingleValue, decryptSingleValue } from "@/lib/encryption";

interface NotesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  existingNotes?: string;
  callStartTime: Date | null;
  callEndTime: Date | null;
  currentPrice?: number;
  hideSessionDetails?: boolean;
  onSuccess?: () => void;
}

// Content component to be used in both Dialog and Drawer
function NotesContent({
  notes,
  setNotes,
  finalPrice,
  setFinalPrice,
  callStartTime,
  callEndTime,
  hideSessionDetails,
  currency,
  className
}: {
  notes: string;
  setNotes: (notes: string) => void;
  finalPrice: string;
  setFinalPrice: (price: string) => void;
  callStartTime: Date | null;
  callEndTime: Date | null;
  hideSessionDetails: boolean;
  currency: string;
  className?: string;
}) {
  const getCallDuration = () => {
    if (!callStartTime || !callEndTime) return 'N/A';
    const duration = Math.round((callEndTime.getTime() - callStartTime.getTime()) / 1000 / 60);
    return `${duration} minutes`;
  };

  return (
    <div className={className}>
      {!hideSessionDetails && (
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
      )}

      <div className="space-y-4">
        {!hideSessionDetails && (
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
        )}

        <Textarea
          placeholder="Enter your session notes here..."
          className="min-h-[200px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </div>
  );
}

export function NotesModal({
  open,
  onOpenChange,
  appointmentId,
  existingNotes = "",
  callStartTime,
  callEndTime,
  currentPrice = 0,
  hideSessionDetails = false,
  onSuccess,
}: NotesModalProps) {
  const isMobile = useIsMobile();
  const [notes, setNotes] = useState(existingNotes);
  const [finalPrice, setFinalPrice] = useState(
    hideSessionDetails ? '' : currentPrice.toString()
  );
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { currency } = useCurrency();

  useEffect(() => {
    const decryptExistingNotes = async () => {
      if (existingNotes) {
        const decryptedNotes = await decryptSingleValue(existingNotes);
        setNotes(decryptedNotes);
      } else {
        setNotes('');
      }
    };
    
    decryptExistingNotes();
    
    if (!hideSessionDetails) {
      setFinalPrice(currentPrice.toString());
    }
  }, [existingNotes, currentPrice, hideSessionDetails, open]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      // Encrypt the notes before saving
      const encryptedNotes = await encryptSingleValue(notes);
      
      const updatePayload: { notes: string; status?: string; price?: number } = {
        notes: encryptedNotes,
      };

      if (!hideSessionDetails) {
        updatePayload.status = 'completed';
        updatePayload.price = parseFloat(finalPrice) || currentPrice;
      }

      const { error } = await supabase
        .from("appointments")
        .update(updatePayload)
        .eq("id", appointmentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: hideSessionDetails ? "Note updated successfully" : "Session details saved successfully",
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: hideSessionDetails ? "Failed to update note" : "Failed to save session details",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const contentProps = {
    notes,
    setNotes,
    finalPrice,
    setFinalPrice,
    callStartTime,
    callEndTime,
    hideSessionDetails,
    currency,
  };

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="mb-4">
              {hideSessionDetails ? "View/Edit Note" : "Session Notes"}
            </DialogTitle>
          </DialogHeader>
          <NotesContent {...contentProps} />
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : (hideSessionDetails ? "Save Note" : "Save Details")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[96vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>
            {hideSessionDetails ? "View/Edit Note" : "Session Notes"}
          </DrawerTitle>
        </DrawerHeader>
        <div className="px-4 overflow-y-auto flex-1">
          <NotesContent {...contentProps} />
        </div>
        <DrawerFooter className="pt-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : (hideSessionDetails ? "Save Note" : "Save Details")}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline" disabled={isSaving}>
              Cancel
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
} 