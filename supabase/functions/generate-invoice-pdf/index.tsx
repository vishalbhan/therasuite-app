/** @jsxImportSource npm:react */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import React from "npm:react@18.2.0";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "npm:@react-pdf/renderer";
import { corsHeaders } from "../_shared/cors.ts";

type AppointmentRecord = {
  id: string;
  therapist_id: string;
  client_name: string;
  client_email: string;
  session_date: string;
  session_type: "video" | "in_person";
  price: number;
  pdf_invoice: string | null;
};

type TherapistProfile = {
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  currency: string | null;
};

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 12,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  header: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 4,
  },
  subHeader: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  label: {
    color: "#6b7280",
    marginBottom: 2,
  },
  value: {
    fontSize: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  footer: {
    marginTop: 24,
    textAlign: "center",
    color: "#6b7280",
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 12,
  },
});

const InvoiceDocument = (props: {
  invoiceNumber: string;
  therapistName: string;
  therapistEmail: string;
  therapistPhone: string;
  clientName: string;
  sessionDate: string;
  sessionType: string;
  amount: string;
}) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>{props.therapistName}</Text>
      <Text style={styles.subHeader}>Non-GST Invoice</Text>

      <View style={styles.section}>
        <View style={styles.row}>
          <View>
            <Text style={styles.label}>Invoice Number</Text>
            <Text style={styles.value}>{props.invoiceNumber}</Text>
          </View>
          <View>
            <Text style={styles.label}>Session Date</Text>
            <Text style={styles.value}>{props.sessionDate}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Therapist Contact</Text>
        <Text style={styles.value}>{props.therapistEmail}</Text>
        <Text style={styles.value}>{props.therapistPhone}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <View style={styles.row}>
          <View>
            <Text style={styles.label}>Client Name</Text>
            <Text style={styles.value}>{props.clientName}</Text>
          </View>
          <View>
            <Text style={styles.label}>Session Type</Text>
            <Text style={styles.value}>{props.sessionType}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View>
            <Text style={styles.label}>Amount</Text>
            <Text style={styles.value}>{props.amount}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.footer}>Thank you</Text>
    </Page>
  </Document>
);

const formatInvoiceNumber = (sessionDate: string, appointmentId: string) => {
  const datePart = new Date(sessionDate).toISOString().slice(0, 10).replace(/-/g, "");
  return `TS-${datePart}-${appointmentId}`;
};

const formatSessionDate = (sessionDate: string) => {
  const date = new Date(sessionDate);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const formatAmount = (amount: number, currency: string | null) => {
  const currencyCode = currency || "INR";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
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
    const { appointment_id: appointmentId } = await req.json();
    if (!appointmentId) {
      return new Response(JSON.stringify({ error: "appointment_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const { data: appointment, error: appointmentError } = await supabaseClient
      .from("appointments")
      .select(
        "id, therapist_id, client_name, client_email, session_date, session_type, price, pdf_invoice"
      )
      .eq("id", appointmentId)
      .maybeSingle<AppointmentRecord>();

    if (appointmentError || !appointment) {
      return new Response(
        JSON.stringify({ error: appointmentError?.message || "Appointment not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (appointment.pdf_invoice) {
      return new Response(JSON.stringify({ skipped: true, pdf_invoice: appointment.pdf_invoice }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: therapistProfile, error: therapistError } = await supabaseClient
      .from("profiles")
      .select("full_name, email, phone_number, currency")
      .eq("id", appointment.therapist_id)
      .maybeSingle<TherapistProfile>();

    if (therapistError) {
      return new Response(JSON.stringify({ error: therapistError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const therapistName = therapistProfile?.full_name || "Therapist";
    const therapistEmail = therapistProfile?.email || "Not provided";
    const therapistPhone = therapistProfile?.phone_number || "Not provided";
    const invoiceNumber = formatInvoiceNumber(appointment.session_date, appointment.id);

    const pdfBuffer = await renderToBuffer(
      <InvoiceDocument
        invoiceNumber={invoiceNumber}
        therapistName={therapistName}
        therapistEmail={therapistEmail}
        therapistPhone={therapistPhone}
        clientName={appointment.client_name}
        sessionDate={formatSessionDate(appointment.session_date)}
        sessionType={appointment.session_type === "video" ? "Video" : "In-Person"}
        amount={formatAmount(appointment.price, therapistProfile?.currency ?? null)}
      />
    );

    const filePath = `therapists/${appointment.therapist_id}/appointments/${appointment.id}.pdf`;
    const { error: uploadError } = await supabaseClient.storage
      .from("invoices")
      .upload(filePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: publicUrlData } = supabaseClient.storage
      .from("invoices")
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData?.publicUrl ?? null;

    if (!publicUrl) {
      return new Response(JSON.stringify({ error: "Failed to generate public URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabaseClient
      .from("appointments")
      .update({ pdf_invoice: publicUrl })
      .eq("id", appointment.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, pdf_invoice: publicUrl }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
