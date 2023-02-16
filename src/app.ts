import cluster from "cluster";
import { primaryProcess, workerProcess } from "./process";

if (cluster.isPrimary) {
    primaryProcess();
} else {
    workerProcess();
}
