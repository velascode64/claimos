import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

const command = process.argv[2] ?? "recipe"
if (command !== "recipe") throw new Error("Usage: bun run agent:recipe")
console.log(await readFile(resolve(import.meta.dir, "../../recipes/claimos-autonomous-discovery.md"), "utf8"))
