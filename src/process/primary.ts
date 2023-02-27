import cluster, { Worker } from "cluster";
import { TARGETS } from "../app-config";
import { logger } from "../modules";

type WorkerTracker = { [system: string]: Worker };

async function forkProcess(system: keyof WorkerTracker): Promise<Worker> {
    const label = `Primary Fork ${system}`;
    const worker = cluster.fork({ SERVICE_SYSTEM: system });

    worker.on("disconnect", () => {
        logger.info(undefined, label, `Worker ${system} has disconnected`);
    });
    worker.on("error", (error) => {
        logger.err(error, label, `Worker ${system} encountered an error`);
    });
    worker.on("exit", (code, signal) => {
        const messages = [`Worker ${system} was killed`];
        if (signal) {
            messages.push(`by signal: ${signal}`);
        }
        messages.push(`with code: ${code}`);
        logger.fatal(undefined, label, messages.join(" "));
    });
    worker.on("message", logger.info);
    worker.on("online", () => {
        logger.info(undefined, label, `Worker ${system} is online`);
    });

    return worker;
}

async function registerProcess(workers: WorkerTracker, system: keyof WorkerTracker) {
    delete workers[system];

    const process: Worker = await forkProcess(system);
    workers[system] = process;
    process.once("exit", async () => {
        logger.info(undefined, `Exiting ${system} worker`, `Attempt to re-initiate ${system} process`);
        await new Promise((resolve) => setTimeout(resolve, 3600 * 1000)); // 1 hour
        await registerProcess(workers, system);
    });
}

export async function primaryProcess() {
    const { npm_package_name, npm_package_version } = process.env;
    const label = [npm_package_name, npm_package_version].filter(Boolean).join(":");
    logger.warn(undefined, label, `Process ${process.pid} started`);

    const workers: WorkerTracker = {};

    Object.keys(TARGETS).forEach(async (system) => registerProcess(workers, system));
}
