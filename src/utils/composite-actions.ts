import { createWriteStream } from "fs";
import { MaybeArray, PrivateKey, decrypt, readMessage } from "openpgp";
import FTP from "sc-ts-ftp";
import { Readable } from "stream";
import { ensureFileDirPath } from "./fs-actions";

export async function downloadAndDecryptFile(ftpClient: FTP, decryptionKeys: MaybeArray<PrivateKey>, remotePath: string, localPath: string): Promise<string> {
    await ftpClient.binary();
    await ensureFileDirPath(localPath);
    const remoteFileStream = await ftpClient.get(remotePath);
    const localFileStream = createWriteStream(localPath, "binary");

    const encryptedMessage = await readMessage({ binaryMessage: new Readable().wrap(remoteFileStream) });
    const decryptedMessage = await decrypt({
        message: encryptedMessage,
        decryptionKeys,
        format: "binary",
    });

    decryptedMessage.data.pipe(localFileStream);
    return new Promise((resolve, reject) => {
        localFileStream.on("close", () => resolve(localPath));
        localFileStream.on("error", reject);
    });
}
