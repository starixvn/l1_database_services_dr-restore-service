import { resolve } from "path";
import { ExecFileOptions, ExecOutput, ensureDirPath, execute, rimraf } from "../utils";

const GIT_FILE = "git";
type GIT_CMD = {
    am: "--abort" | string;
    init: never;
    status: never;
};

class GitAmError extends Error {}

export class Git {
    path: string;
    get executeOptions(): ExecFileOptions {
        return { cwd: this.path };
    }

    constructor(gitFolder: string) {
        this.path = resolve(gitFolder);
    }

    async executeGit(args: readonly string[]): Promise<ExecOutput> {
        return execute(GIT_FILE, args, this.executeOptions);
    }

    async executeCommand<K extends keyof GIT_CMD>(cmd: K, args?: GIT_CMD[K]): Promise<ExecOutput> {
        const gitArgs: string[] = typeof args === "string" ? [args] : args ?? [];
        return this.executeGit([cmd, ...gitArgs]);
    }

    async init(): Promise<void> {
        await this.executeCommand("init");
    }

    async reset(): Promise<void> {
        await rimraf(this.path);
        await ensureDirPath(this.path);
        await this.init();
    }

    async checkAMFailed(): Promise<boolean> {
        const { stdout } = await this.executeCommand("status");

        const midAM = /You are in the middle of an am session./;
        return midAM.test(stdout);
    }

    checkAMOutput(output: ExecOutput): void {
        const { stdout, stderr } = output;
        const patchFailed = /Patch failed at/;
        const hasError = /error: /;

        if (patchFailed.test(stdout)) {
            throw new GitAmError(stdout);
        }
        if (hasError.test(stderr)) {
            throw new GitAmError(stderr);
        }
    }

    async applyPatch(patchFile: string): Promise<void> {
        const abosulePathFile = resolve(patchFile);
        const result = await this.executeCommand("am", abosulePathFile);

        this.checkAMOutput(result);
    }

    async abortPatch(): Promise<void> {
        if (!this.checkAMFailed()) {
            return;
        }
        this.executeCommand("am", "--abort");
        if (!this.checkAMFailed()) {
            throw new GitAmError("Something wrong with git am --abort");
        }
    }

    async ensurePatch(patchFile: string, reset = false): Promise<void> {
        try {
            if (reset) {
                await this.reset();
            }
            await this.applyPatch(patchFile);
        } catch (error: unknown) {
            if (error instanceof GitAmError) {
                this.abortPatch();
            } else {
                throw error;
            }
        }
    }
}
