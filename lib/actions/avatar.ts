"use server"

import { put } from "@vercel/blob"
import { createClient as createServiceClient } from "@/lib/supabase/server"

export async function uploadAvatar(userId: string, file: ArrayBuffer, fileName: string) {
  try {
    const supabase = await createServiceClient()

    // Generate unique filename with timestamp
    const timestamp = Date.now()
    const ext = fileName.split(".").pop() || "jpg"
    const uniqueFileName = `avatars/${userId}-${timestamp}.${ext}`


    // Upload to Vercel Blob
    const blob = await put(uniqueFileName, file, {
      access: "public",
      contentType: `image/${ext}`,
    })

    const avatarUrl = blob.url

    // Update profile with avatar URL
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", userId)

    if (updateError) {
      return { error: updateError.message }
    }

    return { success: true, avatarUrl }
  } catch (err: any) {
    return { error: err.message || "Failed to upload avatar" }
  }
}
