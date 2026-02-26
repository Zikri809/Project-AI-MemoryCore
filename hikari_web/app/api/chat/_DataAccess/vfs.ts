import { createClient } from "@/utils/supabase/server"

// Helper to get the authenticated users profile ID
export async function getAuthUserId() {
    const supabase = await createClient()
    const {
        data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) throw new Error("Unauthorized AI Tool Access: No authenticated user.")

    const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", authUser.id)
        .single()

    if (!user) throw new Error("User profile not found in public database.")

    return { supabase, userId: user.id }
}

export async function listFiles(directory?: string) {
    const { supabase, userId } = await getAuthUserId()
    let query = supabase.from("virtual_files").select("filepath, last_modified").eq("user_id", userId)

    if (directory) {
        query = query.like("filepath", `${directory}%`)
    }

    const { data, error } = await query
    if (error) throw error
    return data
}

export async function readFile(filepath: string) {
    const { supabase, userId } = await getAuthUserId()
    const { data, error } = await supabase
        .from("virtual_files")
        .select("content, last_modified")
        .eq("user_id", userId)
        .eq("filepath", filepath)
        .single()

    if (error) throw error
    return data
}

export async function writeFiles(files: { filepath: string; content: string }[]) {
    const { supabase, userId } = await getAuthUserId()

    const upsertPayload = files.map((f) => ({
        user_id: userId,
        filepath: f.filepath,
        content: f.content,
    }))

    const { error } = await supabase
        .from("virtual_files")
        .upsert(upsertPayload, { onConflict: "user_id, filepath" })

    if (error) throw error
    return true
}
