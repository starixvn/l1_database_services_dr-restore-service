import { mkdir } from "fs/promises";
import { dirname } from "path";

export async function ensureDirPath(folderPath: string): Promise<string> {
    await mkdir(folderPath, { recursive: true });
    return folderPath;
}

export async function ensureFileDirPath(filePath: string): Promise<string> {
    return ensureDirPath(dirname(filePath));
}
