"use server"

import { createClient } from "@/lib/supabase/server"

export async function getRecentPhones() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        phones: [],
      }
    }

    // Query recent_phones table
    const { data, error } = await supabase
      .from("recent_phones")
      .select("phone_number")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)

    if (error) {
      // If table doesn't exist or other error, return empty array
      return { phones: [] }
    }

    return {
      phones: (data || []).map((item) => item.phone_number),
    }
  } catch (error) {
    return {
      phones: [],
    }
  }
}

export async function saveRecentPhone(phoneNumber: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false }
    }

    // Check if this phone already exists
    const { data: existing, error: selectError } = await supabase
      .from("recent_phones")
      .select("id")
      .eq("user_id", user.id)
      .eq("phone_number", phoneNumber)
      .single()

    if (selectError && selectError.code !== "PGRST116") {
      // PGRST116 = no rows found (expected)
      // If it's a different error like table doesn't exist, log and return
      if (selectError.code === "42P01" || selectError.message.includes("does not exist")) {
        return { success: false }
      }
    }

    if (existing) {
      // Update existing record - move to front by updating timestamp
      const { error: updateError } = await supabase
        .from("recent_phones")
        .update({ created_at: new Date().toISOString() })
        .eq("id", existing.id)

      if (updateError) {
        return { success: false }
      }
    } else {
      // Insert new record
      const { error: insertError } = await supabase
        .from("recent_phones")
        .insert([
          {
            user_id: user.id,
            phone_number: phoneNumber,
          },
        ])

      if (insertError) {
        return { success: false }
      }
    }

    // Delete old records beyond 5
    const { data: allRecords, error: fetchError } = await supabase
      .from("recent_phones")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (fetchError) {
      return { success: true } // Still return success even if cleanup fails
    }

    if (allRecords && allRecords.length > 5) {
      const toDelete = allRecords.slice(5).map((r) => r.id)
      const { error: deleteError } = await supabase
        .from("recent_phones")
        .delete()
        .in("id", toDelete)

      if (deleteError) {
      }
    }

    return { success: true }
  } catch (error) {
    return { success: false }
  }
}

export async function deleteRecentPhone(phoneNumber: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "Not authenticated" }
    }

    const { error } = await supabase
      .from("recent_phones")
      .delete()
      .eq("user_id", user.id)
      .eq("phone_number", phoneNumber)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: "Failed to delete number" }
  }
}

