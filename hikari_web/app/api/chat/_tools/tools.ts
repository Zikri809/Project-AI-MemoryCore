import { tool } from "ai"
import { z } from "zod"
import { listFiles, readFile, writeFiles } from "@/app/api/chat/_DataAccess/vfs"

export const buildVfsTools = () => {
    return {
        list_files: tool({
            description: "List all files in the Virtual File System, optionally filtering by directory.",
            inputSchema: z.object({
                directory: z.string().optional().describe("E.g., 'main/' or 'daily-diary/'. If omitted, lists all files."),
            }),
            inputExamples: [{ input: { directory: "main/" } }],
            execute: async ({ directory }) => {
                try {
                    const data = await listFiles(directory)
                    return { success: true, files: data }
                } catch (e) {
                    const err = e as Error;
                    return { success: false, error: err.message }
                }
            },
        }),

        read_file: tool({
            description: "Read the exact textual content of a specific file from the Virtual File System.",
            inputSchema: z.object({
                filepath: z.string().describe("Exact path, e.g., 'main/identity-core.md'"),
            }),
            inputExamples: [{ input: { filepath: "main/identity-core.md" } }],
            execute: async ({ filepath }) => {
                try {
                    const data = await readFile(filepath)
                    return { success: true, filepath, content: data.content, last_modified: data.last_modified }
                } catch (e) {
                    const err = e as Error;
                    if (err.message.includes("PGRST116")) {
                        return { success: false, message: `File '${filepath}' not found or is empty.` }
                    }
                    return { success: false, error: err.message }
                }
            },
        }),

        write_files: tool({
            description: "Atomically create or update one or multiple files in the Virtual File System.",
            inputSchema: z.object({
                files: z.array(
                    z.object({
                        filepath: z.string().describe("Exact path, e.g., 'main/current-session.md'"),
                        content: z.string().describe("The full markdown content to save."),
                    })
                ).describe("An array of files to write atomically."),
            }),
            inputExamples: [
                {
                    input: {
                        files: [
                            { filepath: "main/current-session.md", content: "# Session context\n..." },
                            { filepath: "main/relationship-memory.md", content: "..." }
                        ]
                    }
                }
            ],
            execute: async ({ files }) => {
                try {
                    await writeFiles(files)
                    return { success: true, message: `Successfully saved ${files.length} file(s).` }
                } catch (e) {
                    const err = e as Error;
                    return { success: false, error: err.message }
                }
            },
        }),
    }
}
