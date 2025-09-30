import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  children?: React.ReactNode;
  isLoading?: boolean;
}

export function ConfirmModal({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = "Continue",
  cancelText = "Cancel",
  children,
  isLoading = false,
}: ConfirmModalProps) {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          {children && (
            <div className="px-6 py-4">
              {children}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>{cancelText}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={onConfirm} 
              className="bg-red-600 hover:bg-red-700"
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        {children && (
          <div className="px-4 py-4">
            {children}
          </div>
        )}
        <DrawerFooter className="pt-6">
          <Button 
            onClick={onConfirm} 
            className="bg-red-600 hover:bg-red-700 text-white"
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : confirmText}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline" disabled={isLoading}>{cancelText}</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
} 