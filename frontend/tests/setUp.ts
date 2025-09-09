import test from "@playwright/test"
import { spawnSync } from "child_process"

test("Flush database", async ({ }) => {
    const result = spawnSync("python", ["manage.py", "flush", "--no-input"], {
        cwd: "../backend",
        stdio: "inherit",
        env: { ...process.env }
    })

    if (result.status !== 0) {
        throw new Error("Failed to set database before each test.")
    }
})