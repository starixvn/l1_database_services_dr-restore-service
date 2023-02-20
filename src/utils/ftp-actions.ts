import { createWriteStream } from "fs";
import { FTP, Options } from "sc-ts-ftp";
import { ensureFileDirPath } from ".";
import { logger } from "../modules";
import { ErrorWithCode } from "../interfaces";

const RETRY_WAIT = 10000;

export async function connectFTP(config: Options, maxRetry = 5): Promise<FTP> {
    const ftpClient = new FTP();
    const { host, port } = config;
    const label = `FTP ${host}:${port}`;

    let retry = 1;
    while (retry <= maxRetry) {
        try {
            await ftpClient.connect(config);
            break;
        } catch (err: unknown) {
            if (err instanceof Error) {
                logger.info(undefined, label, `[${retry}] ${err.message}`);
            }
            await new Promise((resolve) => setTimeout(resolve, RETRY_WAIT))
            retry++;
            if (retry > maxRetry) {
                const error = err as ErrorWithCode;
                error.code = 522;
                error.message += ` ${host}:${port}`;
                throw error;
            }
        }
    }
    await ftpClient.binary();
    return ftpClient;
}

export async function downloadFile(ftpClient: FTP, remotePath: string, localPath: string): Promise<string> {
    await ftpClient.binary();
    await ensureFileDirPath(localPath);
    const remoteFileStream = await ftpClient.get(remotePath);
    const localFileStream = createWriteStream(localPath, "binary");

    remoteFileStream.pipe(localFileStream);
    return new Promise((resolve, reject) => {
        localFileStream.on("close", () => resolve(localPath));
        localFileStream.on("error", reject);
    });
}

export async function deleteFilesBeforeTime(ftpClient: FTP, listPath: string, time: Date, filter?: string) {
    const filterPath = [listPath, filter].filter(Boolean).join("/");
    const files = (await ftpClient.list(filterPath)).filter((file) => file.date.valueOf() < time.valueOf());
    const tasks = files.map(async (file) => {
        const fullPath = `${listPath}/${file.name}`;
        await ftpClient.delete(fullPath);
        return file.name;
    });
    return Promise.all(tasks);
}
