import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type AppointmentRecord = {
  id: string;
  therapist_id: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const startDate = new Date("2026-02-01T00:00:00.000Z");

    const { data: appointments, error: appointmentsError } = await supabaseClient
      .from("appointments")
      .select("id, therapist_id")
      .eq("status", "completed")
      .is("pdf_invoice", null)
      .gte("session_date", startDate.toISOString())
      .returns<AppointmentRecord[]>();

    if (appointmentsError) {
      return new Response(JSON.stringify({ error: appointmentsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const functionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-invoice-pdf`;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const results = {
      processed: 0,
      generated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const appointment of appointments || []) {
      try {
        results.processed += 1;
        const response = await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ appointment_id: appointment.id }),
        });

        const payload = await response.json();
        if (!response.ok) {
          results.errors.push(
            `Appointment ${appointment.id}: ${payload?.error || "Unknown error"}`
          );
          continue;
        }

        if (payload?.skipped) {
          results.skipped += 1;
        } else {
          results.generated += 1;
        }
      } catch (error) {
        results.errors.push(`Appointment ${appointment.id}: ${error.message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
