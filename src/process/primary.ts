import cluster from "cluster";
import { TARGETS } from "../app-config";
import { logger } from "../modules";

export async function primaryProcess() {
    const label = "Primary";
    logger.warn(undefined, label, `Process ${process.pid} started`);

    Object.keys(TARGETS).forEach((system) => {
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
    });
}
