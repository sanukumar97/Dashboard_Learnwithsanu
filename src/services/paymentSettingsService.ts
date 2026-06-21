import { supabase } from "../lib/supabase";

export interface PaymentSettings {
  id: string;
  upi_id: string;
  upi_name: string;
  support_phone: string;
  support_display: string;
  qr_code_url: string | null;
}

export async function fetchPaymentSettingsAdmin(): Promise<PaymentSettings | null> {
  const { data, error } = await supabase
    .from("payment_settings")
    .select("id, upi_id, upi_name, support_phone, support_display, qr_code_url")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updatePaymentSettingsAdmin(
  id: string,
  patch: Partial<Omit<PaymentSettings, "id">>,
) {
  const { error } = await supabase.from("payment_settings").update(patch).eq("id", id);
  if (error) throw error;
}

export async function uploadQrCode(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `qr-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("payment-assets")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("payment-assets").getPublicUrl(path);
  return data.publicUrl;
}
