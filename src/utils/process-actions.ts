import { execFile, ExecFileOptions } from "child_process";
import { promisify } from "util";

export type ExecOutput = {
    stdout: string;
    stderr: string;
};

export { ExecFileOptions };

export const execute = promisify(execFile);
