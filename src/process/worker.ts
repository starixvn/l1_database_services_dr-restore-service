import { ListingElement } from "sc-ts-ftp";
import { FTP_CONFIG, PRIVATE_KEY_PATH, TARGETS } from "../app-config";
import { Git, escapeMarkdownV2, logger } from "../modules";
import { compareDateAsc, compareDateDesc, connectFTP, deleteFilesBeforeTime, downloadAndDecryptFile, isSquashFile, readPrivateKeyFile, rimraf, updatePatchTime } from "../utils";
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

function filterFtpFileByTime(file: ListingElement, startDate?: Date, endDate?: Date): boolean {
    const { date } = file;

    if (startDate && startDate.valueOf() >= date.valueOf()) {
        return false;
    }
    if (endDate && endDate.valueOf() <= date.valueOf()) {
        return false;
    }

    return true;
}

async function loopProcess(handlers: Handlers, system: string, target: SystemTarget, lastDate: Date): Promise<Date> {
    const label = `Loop ${system}`;

    const { ftpClient } = handlers;
    const { ftpPath } = target;

    let listFiles = (await ftpClient.list(ftpPath)).map(updatePatchTime);
    logger.debug(undefined, label, `Fetched ${listFiles.length} from ftp server`)
    let latestDate = lastDate;

    if (lastDate) {
        logger.info(undefined, label, `Fetched ${listFiles.length} files, filtering files from ${lastDate.toISOString()}`);
        listFiles = listFiles.filter((file) => filterFtpFileByTime(file, lastDate));
    }
    listFiles.sort(compareDateDesc);

    if (!listFiles.length) {
        logger.info(undefined, label, `No new files to process`);
        return lastDate;
    }

    logger.info(undefined, label, `Listed ${listFiles.length} files to process`);

    /** If bug file in use still persist, update this code to length > 1 to exclude latest file */
    let file: ListingElement | undefined;
    while (listFiles.length > 1) {
        try {
            file = listFiles.pop();
            if (!file) {
                break;
            }
            await fileHandlingProcess(handlers, system, target, file);
            latestDate = file.date;
        } catch (err: unknown) {
            let code = 100;
            if (Object.keys(err as Object).includes("code")) {
                code = (err as ErrorWithCode).code;
            }

            if (![550].includes(code)) {
                await logger.warn(err, label, `(${code}) ${file?.name}`);
                process.exit(code);
            } else {
                await logger.err(err, label, `Encountered an error while processing file ${file?.name}`);
                return latestDate;
            }
        }
    }

    return latestDate;
}

async function startupProcess(handlers: Handlers, system: string, target: SystemTarget) {
    const label = `Startup ${system}`;

    const { ftpClient } = handlers;
    const { ftpPath } = target;
    const squashFiles = await ftpClient.list(`${ftpPath}/*Squash*`);
    squashFiles.sort(compareDateAsc);
    const latestSquash = squashFiles.pop();
    if (latestSquash) {
        const { name, date } = latestSquash;
        logger.info(undefined, label, `Cleanup files before ${name} - ${date.toISOString()}`);
        await fileCleanupProcess(handlers, system, target, date);
    }
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

    let lastDate: Date = new Date(0);
    while (true) {
        lastDate = await loopProcess(handlers, system, target, lastDate);
        await new Promise((resolve) => {
            setTimeout(resolve, 5 * 60 * 1000);
        });
    }
}
