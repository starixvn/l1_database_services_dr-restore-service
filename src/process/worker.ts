import { ListingElement } from "sc-ts-ftp";
import { FTP_CONFIG, PRIVATE_KEY_PATH, TARGETS } from "../app-config";
import { Git, escapeMarkdownV2, logger } from "../modules";
import { compareDateAsc, compareDateDesc, connectFTP, deleteFilesBeforeTime, downloadAndDecryptFile, isSquashFile, readPrivateKeyFile, rimraf } from "../utils";
import { ErrorWithCode, Handlers, SystemTarget } from "../interfaces";
import { resolve } from "path";

async function fileCleanupProcess(handlers: Handlers, system: string, target: SystemTarget, expiredDate: Date): Promise<void> {
    const label = `Cleanup ${system} @ ${expiredDate.toISOString()}`;

    const { ftpClient } = handlers;
    const { ftpPath, localPath } = target;
    const expiredFiles = await deleteFilesBeforeTime(ftpClient, ftpPath, expiredDate);

    if (!expiredFiles.length) {
        return;
    }

    const tasks = await Promise.all(
        expiredFiles.map(async (fileName) => {
            rimraf(resolve(localPath, fileName));
            return fileName;
        })
    );
    logger.info(escapeMarkdownV2(tasks.join("\n")), label, `${tasks.length} files were cleaned:`);
}

async function fileHandlingProcess(handlers: Handlers, system: string, target: SystemTarget, file: ListingElement): Promise<string> {
    const { name, date } = file;
    const label = `File ${system}/${name}`;

    const { ftpClient, privateKey, git } = handlers;
    const { ftpPath, localPath } = target;
    const ftpFullPath = resolve(ftpPath, name);
    const localFullPath = resolve(localPath, name);
    const isSquash = isSquashFile(name);

    await downloadAndDecryptFile(ftpClient, privateKey, ftpFullPath, localFullPath);
    await git.ensurePatch(localFullPath, isSquash);
    if (isSquash) {
        logger.warn(undefined, label, `Squash file encountered. Git folder "${git.path}" was reset.`);
        fileCleanupProcess(handlers, system, target, date);
    } else {
        logger.info(undefined, label, `Patch applied.`);
    }

    return name;
}

async function loopProcess(handlers: Handlers, system: string, target: SystemTarget, lastDate?: Date): Promise<Date> {
    const label = `Loop ${system}`;

    const { ftpClient } = handlers;
    const { ftpPath } = target;

    let listFiles = await ftpClient.list(ftpPath);
    let latestDate = lastDate;

    if (lastDate) {
        logger.info(undefined, label, `Fetched ${listFiles.length} files, filtering files from ${lastDate.toISOString()}`);
        listFiles = listFiles.filter((file) => file.date.valueOf() > lastDate.valueOf());
    }
    listFiles.sort(compareDateDesc);

    if (!listFiles.length) {
        logger.info(undefined, label, `No new files to process`);
        return lastDate;
    }

    logger.info(undefined, label, `Listed ${listFiles.length} files to process`);

    while (listFiles.length) {
        try {
            const file = listFiles.pop();
            await fileHandlingProcess(handlers, system, target, file);
            latestDate = file.date;
        } catch (err: unknown) {
            let code = 100;
            if (Object.keys(err).includes("code")) {
                code = (err as ErrorWithCode).code;
            }
            await logger.fatal(err, label, `(${code}) Encountered an error while processing files`);

            if (![550].includes(code)) {
                process.exit(code);
            } else {
                return latestDate;
            }
        }
    }

    return latestDate;
}

async function startupProcess(handlers: Handlers, system: string, target: SystemTarget) {
    const { ftpClient } = handlers;
    const { ftpPath } = target;
    const squashFiles = await ftpClient.list(`${ftpPath}/*Squash*`);
    squashFiles.sort(compareDateAsc);
    const latestSquash = squashFiles.pop();
    await fileCleanupProcess(handlers, system, target, latestSquash.date);
}

export async function workerProcess() {
    const system = process.env.SERVICE_SYSTEM;
    const label = `Worker ${system}`;

    if (!system) {
        await logger.fatal(undefined, "Worker", `SERVICE_SYSTEM is not defined in process ${process.pid}`);
        process.exit(1);
    }
    logger.warn(undefined, label, `Worker ${system} [${process.pid}] started`);

    const target = TARGETS[system];
    const ftpClient = await connectFTP(FTP_CONFIG);
    const privateKey = await readPrivateKeyFile(PRIVATE_KEY_PATH);
    const git = new Git(target.gitPath);

    const handlers: Handlers = { ftpClient, privateKey, git };
    await startupProcess(handlers, system, target);

    let lastDate: Date = null;
    while (true) {
        lastDate = await loopProcess(handlers, system, target, lastDate);
        await new Promise((resolve) => {
            setTimeout(resolve, 5 * 60 * 1000);
        });
    }
}
