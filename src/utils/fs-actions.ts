import { mkdir } from "fs/promises";
import { dirname } from "path";

export async function ensureDirPath(folderPath: string): Promise<string> {
    return mkdir(folderPath, { recursive: true });
}

export async function ensureFileDirPath(filePath: string): Promise<string> {
    return ensureDirPath(dirname(filePath));
}
