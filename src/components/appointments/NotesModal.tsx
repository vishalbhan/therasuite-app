import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface NotesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  existingNotes?: string;
  onSuccess?: () => void;
}

export function NotesModal({
  open,
  onOpenChange,
  appointmentId,
  existingNotes = "",
  onSuccess,
}: NotesModalProps) {
  const [notes, setNotes] = useState(existingNotes);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Update notes when existingNotes changes
  useEffect(() => {
    setNotes(existingNotes);
  }, [existingNotes]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const { error } = await supabase
        .from("appointments")
        .update({ 
          notes,
          status: 'completed' // Update status to completed when saving notes after call
        })
        .eq("id", appointmentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Notes saved successfully",
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to save notes",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Session Notes</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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