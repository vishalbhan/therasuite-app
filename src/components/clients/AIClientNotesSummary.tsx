import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { decryptSingleValue } from '@/lib/encryption';
import { toast } from 'sonner';
import { RefreshCw, Sparkles } from 'lucide-react';
import OpenAI from 'openai';

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

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true // Note: In production, this should be handled server-side
  });

  const fetchClientNotes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
        setSummary('No therapy notes available for this client yet.');
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
      // Prepare notes text for OpenAI
      const notesText = notes.map((note, index) => 
        `Session ${index + 1} (${new Date(note.session_date).toLocaleDateString()}, ${note.session_type}, ${note.session_length} min):\n${note.notes}`
      ).join('\n\n');

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a professional therapy assistant. Analyze the following therapy session notes and provide a comprehensive summary that includes: 1) Key themes and patterns, 2) Client's progress and improvements, 3) Ongoing challenges, 4) Treatment approaches that are working, 5) Recommendations for future sessions. Keep the summary professional, concise, and focused on therapeutic insights."
          },
          {
            role: "user",
            content: `Please summarize these therapy session notes:\n\n${notesText}`
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const generatedSummary = completion.choices[0]?.message?.content || 'Unable to generate summary';
      setSummary(generatedSummary);
      toast.success('AI summary generated successfully');
    } catch (error) {
      console.error('Error generating AI summary:', error);
      toast.error('Failed to generate AI summary. Please check your OpenAI API key.');
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
          <Textarea
            id="ai-summary"
            value={summary || 'Click "Generate Summary" to create an AI-powered analysis of this client\'s therapy notes.'}
            disabled={true}
            className="min-h-[120px] bg-gray-50 text-gray-700"
          />
        )}
        
        {hasNotes && (
          <div className="mt-3 text-xs text-gray-500">
            Based on {notes.length} therapy session{notes.length !== 1 ? 's' : ''}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
