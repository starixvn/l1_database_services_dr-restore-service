import { createWriteStream } from "fs";
import { FTP, Options } from "sc-ts-ftp";
import { ensureFileDirPath } from ".";

export async function connectFTP(config: Options): Promise<FTP> {
    const ftpClient = new FTP();
    await ftpClient.connect(config);
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
