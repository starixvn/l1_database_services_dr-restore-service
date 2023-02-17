import { createReadStream, createWriteStream } from "fs";
import { readFile } from "fs/promises";
import { MaybeArray, PrivateKey, decrypt, readMessage, readPrivateKey } from "openpgp";
import { ensureFileDirPath } from "./fs-actions";

export async function readPrivateKeyFile(path: string): Promise<PrivateKey> {
    const privateKey: Uint8Array = await readFile(path);
    return readPrivateKey({ binaryKey: privateKey });
}

export async function decryptFile(decryptionKeys: MaybeArray<PrivateKey>, inputFile: string, outputFile: string): Promise<string> {
    await ensureFileDirPath(outputFile);
    const inputFileStream = createReadStream(inputFile);
    const outputFileStream = createWriteStream(outputFile);

    const encryptedMessage = await readMessage({ binaryMessage: inputFileStream });
    const decryptedMessage = await decrypt({
        message: encryptedMessage,
        decryptionKeys,
        format: "binary",
    });

    decryptedMessage.data.pipe(outputFileStream);
    return new Promise((resolve, reject) => {
        outputFileStream.on("close", () => resolve(outputFile));
        outputFileStream.on("error", reject);
    });
}
