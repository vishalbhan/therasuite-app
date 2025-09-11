import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { decryptSingleValue } from '@/lib/encryption';
import { toast } from 'sonner';
import { RefreshCw, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AIClientNotesSummaryProps {
  clientId: string;
}

interface AppointmentNote {
  id: string;
  session_date: string;
  notes: string;
  session_type: string;
  session_length: number;
}


export function AIClientNotesSummary({ clientId }: AIClientNotesSummaryProps) {
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<AppointmentNote[]>([]);
  const [hasNotes, setHasNotes] = useState(false);


  const saveSummaryToDatabase = async (summary: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user found when saving summary');
        return;
      }

      const { error } = await supabase
        .from('clients')
        .update({ ai_summary: summary })
        .eq('id', clientId)
        .eq('therapist_id', user.id);

      if (error) {
        console.error('Error saving AI summary to database:', error);
        toast.error('Failed to save summary to database');
      }
    } catch (error) {
      console.error('Error saving AI summary:', error);
      toast.error('Failed to save summary to database');
    }
  };

  const fetchClientNotes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch client data including existing AI summary
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('ai_summary')
        .eq('id', clientId)
        .eq('therapist_id', user.id)
        .single();

      if (clientError) {
        console.error('Error fetching client data:', clientError);
      } else if (clientData?.ai_summary) {
        setSummary(clientData.ai_summary);
      }

      // Fetch all appointments with notes for this client
      const { data: appointmentsData, error } = await supabase
        .from('appointments')
        .select('id, session_date, notes, session_type, session_length')
        .eq('client_id', clientId)
        .eq('therapist_id', user.id)
        .not('notes', 'is', null)
        .not('notes', 'eq', '')
        .order('session_date', { ascending: true });

      if (error) throw error;

      if (!appointmentsData || appointmentsData.length === 0) {
        setHasNotes(false);
        if (!clientData?.ai_summary) {
          setSummary('No therapy notes available for this client yet.');
        }
        return;
      }

      // Decrypt notes
      const decryptedNotes = await Promise.all(
        appointmentsData.map(async (appointment) => ({
          ...appointment,
          notes: await decryptSingleValue(appointment.notes)
        }))
      );

      setNotes(decryptedNotes);
      setHasNotes(true);
    } catch (error) {
      console.error('Error fetching client notes:', error);
      toast.error('Failed to fetch client notes');
    }
  };

  const generateAISummary = async () => {
    if (!hasNotes || notes.length === 0) {
      toast.error('No notes available to summarize');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Authentication required');
        return;
      }

      // Call the Supabase Edge Function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/generate-ai-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          notes: notes
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to generate summary');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.details || 'Failed to generate summary');
      }

      setSummary(result.summary);
      
      // Save the summary to the clients table
      await saveSummaryToDatabase(result.summary);
      
      toast.success('AI summary generated successfully');
    } catch (error) {
      console.error('Error generating AI summary:', error);
      toast.error(`Failed to generate AI summary: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchClientNotes();
    }
  }, [clientId]);

  return (
    <Card className="mb-6 bg-white shadow-lg rounded-xl">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI Notes Summary
          </h2>
          {hasNotes && (
            <Button
              onClick={generateAISummary}
              disabled={loading}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Generating...' : 'Generate Summary'}
            </Button>
          )}
        </div>
        
        {!hasNotes ? (
          <div className="text-center py-8 text-gray-500">
            <Sparkles className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium mb-1">No therapy notes yet</p>
            <p className="text-sm">Complete some appointments with notes to generate an AI summary</p>
          </div>
        ) : (
          <div className="min-h-[180px] rounded-md p-4">
            {summary ? (
              <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-li:text-gray-700 prose-strong:text-gray-900">
                <ReactMarkdown
                  components={{
                    p: ({node, ...props}) => (
                      <p style={{ marginBottom: '1rem' }} {...props} />
                    ),
                  }}
                >
                  {summary}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center h-full">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">Generate summary based on client notes</p>
                </div>
              </div>
            )}
          </div>
        )}
        
        {hasNotes && (
          <div className="mt-3 text-xs text-gray-500">
            Based on notes from {notes.length} session{notes.length !== 1 ? 's' : ''}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
