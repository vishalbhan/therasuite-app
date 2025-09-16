import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { FileText, History, ChevronDown } from 'lucide-react';
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { NotesModal } from '@/components/appointments/NotesModal';
import { decryptSingleValue } from '@/lib/encryption';
import React from 'react';

interface Note {
  id: string;
  client_name: string;
  client_email: string;
  client_id: string;
  session_date: string;
  notes: string;
  session_type: 'video' | 'in-person';
  price: number;
}

interface DecryptedNote extends Note {
  decrypted_client_name: string;
  decrypted_client_email: string;
  decrypted_notes: string;
}

// Helper function to truncate text
const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [decryptedNotes, setDecryptedNotes] = useState<DecryptedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewingNotes, setViewingNotes] = useState<{
    appointmentId: string;
    notes: string;
    price: number;
  } | null>(null);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 10;
  const navigate = useNavigate();

  const fetchNotes = async (pageNumber = 0, replace = true) => {
    try {
      setLoadingMore(pageNumber > 0);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const from = pageNumber * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('appointments')
        .select('id, client_name, client_email, client_id, session_date, notes, session_type, price', { count: 'exact' })
        .eq('therapist_id', user.id)
        .not('notes', 'is', null)
        .not('notes', 'eq', '')
        .order('session_date', { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Update hasMore flag
      setHasMore(count ? from + pageSize < count : false);
      
      // Either replace notes or append to existing notes
      if (replace) {
        setNotes(data as Note[]);
      } else {
        setNotes(prev => [...prev, ...(data as Note[])]);
      }

      // Decrypt client names, emails, and notes
      const notesToDecrypt = replace ? (data as Note[]) : (data as Note[]);
      const decryptedNotesData = await Promise.all(
        notesToDecrypt.map(async (note) => ({
          ...note,
          decrypted_client_name: await decryptSingleValue(note.client_name),
          decrypted_client_email: await decryptSingleValue(note.client_email),
          decrypted_notes: await decryptSingleValue(note.notes)
        }))
      );

      if (replace) {
        setDecryptedNotes(decryptedNotesData);
      } else {
        setDecryptedNotes(prev => [...prev, ...decryptedNotesData]);
      }
    } catch (error) {
      toast.error("Error fetching notes");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  // Reset pagination when client filter changes
  useEffect(() => {
    setPage(0);
    fetchNotes(0);
  }, [selectedClient]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNotes(nextPage, false);
  };

  // Filter notes based on selected client
  const filteredNotes = React.useMemo(() => {
    if (!selectedClient) return decryptedNotes;
    return decryptedNotes.filter(note => note.decrypted_client_name === selectedClient);
  }, [decryptedNotes, selectedClient]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-9rem)]">
        <div className="text-lg text-gray-500 mb-2">No notes yet</div>
        <div className="text-sm text-gray-400">
          Notes will appear here after completing appointments
        </div>
      </div>
    );
  }

  return (
    <div className="container px-4 sm:px-6 mx-auto py-6 max-w-[95%] sm:max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Session Notes</h1>
        <div className="relative">
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="w-[280px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm ring-offset-background transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 hover:border-gray-300 appearance-none cursor-pointer"
          >
            <option value="">All Clients</option>
            {Array.from(new Set(decryptedNotes.map(note => note.decrypted_client_name))).map(client => (
              <option key={client} value={client}>
                {client}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>
      
      {/* Card Grid View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredNotes.map((note) => (
          <div 
            key={note.id}
            className="bg-white rounded-2xl border shadow-lg p-6 space-y-4 hover:shadow-xl transition-all duration-200 cursor-pointer"
            onClick={() => setViewingNotes({
              appointmentId: note.id,
              notes: note.decrypted_notes,
              price: note.price
            })}
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-lg truncate">{note.decrypted_client_name}</div>
                <div className="text-sm text-gray-500 truncate">{note.decrypted_client_email}</div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/clients/${note.client_id}`);
                }}
                className="h-8 w-8 p-0 rounded-full text-gray-500 hover:text-purple-600 hover:bg-purple-50"
              >
                <History className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2 mt-4">
              <div className="flex items-center text-xs text-gray-500">
                <History className="h-3 w-3 mr-2 flex-shrink-0" />
                <span className="font-medium">Session Date:</span>
                <span className="ml-2">
                  {format(new Date(note.session_date), 'MMM d, yyyy')}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-sm text-gray-600 font-medium mb-2">Session Notes:</div>
              <div className="text-sm text-gray-600 line-clamp-3">
                {truncateText(note.decrypted_notes, 120)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center mt-6">
          <Button
            variant="outline"
            size="lg"
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full max-w-xs"
          >
            {loadingMore ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
              </span>
            ) : (
              <span className="flex items-center">
                <ChevronDown className="h-4 w-4 mr-2" />
                Load More Notes
              </span>
            )}
          </Button>
        </div>
      )}

      <NotesModal
        open={!!viewingNotes}
        onOpenChange={(open) => !open && setViewingNotes(null)}
        appointmentId={viewingNotes?.appointmentId || ''}
        existingNotes={viewingNotes?.notes || ''}
        currentPrice={viewingNotes?.price || 0}
        callStartTime={null}
        callEndTime={null}
        hideSessionDetails={true}
        onSuccess={() => {
          // Refresh the first page of notes
          fetchNotes(0);
        }}
      />
    </div>
  );
} 