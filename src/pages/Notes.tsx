import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { FileText, Eye, History } from 'lucide-react';
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { NotesModal } from '@/components/appointments/NotesModal';
import React from 'react';

interface Note {
  id: string;
  client_name: string;
  client_id: string;
  session_date: string;
  notes: string;
  session_type: 'video' | 'in-person';
  price: number;
}

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingNotes, setViewingNotes] = useState<{
    appointmentId: string;
    notes: string;
    price: number;
  } | null>(null);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('appointments')
          .select('id, client_name, client_id, session_date, notes, session_type, price')
          .eq('therapist_id', user.id)
          .not('notes', 'is', null)
          .not('notes', 'eq', '')
          .order('session_date', { ascending: false });

        if (error) throw error;

        setNotes(data as Note[]);
      } catch (error) {
        toast.error("Error fetching notes");
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, []);

  // Filter notes based on selected client
  const filteredNotes = React.useMemo(() => {
    if (!selectedClient) return notes;
    return notes.filter(note => note.client_name === selectedClient);
  }, [notes, selectedClient]);

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
        <select
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
          className="w-[250px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="">All Clients</option>
          {Array.from(new Set(notes.map(note => note.client_name))).map(client => (
            <option key={client} value={client}>
              {client}
            </option>
          ))}
        </select>
      </div>
      
      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="py-4 px-4 text-left font-medium text-gray-500">Client</th>
              <th className="py-4 px-4 text-left font-medium text-gray-500">Date</th>
              <th className="py-4 px-4 text-left font-medium text-gray-500">Notes</th>
              <th className="py-4 px-4 text-right font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredNotes.map((note) => (
              <tr key={note.id} className="hover:bg-gray-50">
                <td className="py-4 px-4">
                  <div className="font-medium">{note.client_name}</div>
                </td>
                <td className="py-4 px-4 text-gray-500">
                  {format(new Date(note.session_date), 'MMM d, yyyy')}
                </td>
                <td className="py-4 px-4">
                  <div className="text-sm text-gray-600 line-clamp-2">
                    {note.notes}
                  </div>
                </td>
                <td className="py-4 px-4 text-right space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewingNotes({
                      appointmentId: note.id,
                      notes: note.notes,
                      price: note.price
                    })}
                    className="text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                  >
                    <Eye className="h-4 w-4 mr-0.5" />
                    View Note
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/clients/${note.client_id}`)}
                    className="text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                  >
                    <History className="h-4 w-4 mr-0.5" />
                    Client History
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filteredNotes.map((note) => (
          <div 
            key={note.id}
            className="bg-white rounded-lg border shadow-sm p-4 space-y-4"
          >
            <div>
              <div className="font-medium">{note.client_name}</div>
              <div className="text-sm text-gray-500">
                {format(new Date(note.session_date), 'MMM d, yyyy')}
              </div>
            </div>

            <div className="text-sm text-gray-600 line-clamp-3">
              {note.notes}
            </div>

            <div className="flex space-x-2 pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewingNotes({
                  appointmentId: note.id,
                  notes: note.notes,
                  price: note.price
                })}
                className="flex-1 text-gray-500 hover:text-purple-600 hover:bg-purple-50"
              >
                <Eye className="h-4 w-4 mr-1.5" />
                View Note
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/clients/${note.client_id}`)}
                className="flex-1 text-gray-500 hover:text-purple-600 hover:bg-purple-50"
              >
                <History className="h-4 w-4 mr-1.5" />
                Client History
              </Button>
            </div>
          </div>
        ))}
      </div>

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
          const fetchNotes = async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;
              const { data, error } = await supabase
                .from('appointments')
                .select('id, client_name, client_id, session_date, notes, session_type, price')
                .eq('therapist_id', user.id)
                .not('notes', 'is', null)
                .not('notes', 'eq', '')
                .order('session_date', { ascending: false });
              if (error) throw error;
              setNotes(data as Note[]);
            } catch (error) {
              toast.error("Error refreshing notes");
            }
          };
          fetchNotes();
        }}
      />
    </div>
  );
} 