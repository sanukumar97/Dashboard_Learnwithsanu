import { supabase } from "../lib/supabase";

export interface BannerSettings {
  id: string;
  badge_text: string;
  headline: string;
  subtitle: string;
  pills: string[];
  image_url: string | null;
}

export async function fetchBannerSettingsAdmin(): Promise<BannerSettings | null> {
  const { data, error } = await supabase
    .from("banner_settings")
    .select("id, badge_text, headline, subtitle, pills, image_url")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as BannerSettings | null;
}

export async function updateBannerSettingsAdmin(
  id: string,
  patch: Partial<Omit<BannerSettings, "id">>,
) {
  const { error } = await supabase.from("banner_settings").update(patch).eq("id", id);
  if (error) throw error;
}

export async function uploadBannerImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `banner-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("payment-assets")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("payment-assets").getPublicUrl(path);
  return data.publicUrl;
}
