// Edge Function: send-demo-email
// Mengirim email otomatis lewat Gmail SMTP saat ada calon klien minta demo,
// atau saat staf klik tombol follow-up di tab Leads.
import { SmtpClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const GMAIL_USER = Deno.env.get("GMAIL_USER")!;       // alamat Gmail pengirim
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD")!; // App Password 16 digit
const DEMO_URL = Deno.env.get("DEMO_URL")!;            // link app Satria Rental
const DEMO_EMAIL = Deno.env.get("DEMO_EMAIL")!;        // email akun demo bersama
const DEMO_PASSWORD = Deno.env.get("DEMO_PASSWORD")!;  // password akun demo bersama

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { nama, email, mode } = await req.json();
    if (!nama || !email) {
      return new Response(JSON.stringify({ error: "nama dan email wajib diisi" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isFollowup = mode === "followup";
    const subject = isFollowup
      ? "Masih tertarik dengan Satria Rental? 🚗"
      : "Akses Demo Satria Rental Anda";

    const body = isFollowup
      ? `Halo ${nama},\n\nBeberapa waktu lalu Anda sempat mencoba demo sistem Satria Rental. Kami ingin follow-up, apakah ada pertanyaan atau ingin melanjutkan diskusi?\n\nAkses demo Anda masih aktif:\nLink: ${DEMO_URL}\nEmail: ${DEMO_EMAIL}\nPassword: ${DEMO_PASSWORD}\n\nBalas email ini kapan saja, kami siap bantu.\n\nSalam,\nSatria Rental`
      : `Halo ${nama},\n\nTerima kasih sudah tertarik dengan sistem Satria Rental. Berikut akses demo Anda:\n\nLink: ${DEMO_URL}\nEmail: ${DEMO_EMAIL}\nPassword: ${DEMO_PASSWORD}\n\nSilakan dicoba, dan jangan ragu menghubungi kami kalau ada pertanyaan.\n\nSalam,\nSatria Rental`;

    const client = new SmtpClient();
    await client.connect({
      hostname: "smtp.gmail.com",
      port: 465,
      username: GMAIL_USER,
      password: GMAIL_APP_PASSWORD,
    });
    await client.send({
      from: GMAIL_USER,
      to: email,
      subject,
      content: body,
    });
    await client.close();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
