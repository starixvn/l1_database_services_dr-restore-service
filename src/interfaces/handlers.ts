import { PrivateKey } from "openpgp";
import FTP from "sc-ts-ftp";
import { Git } from "../modules";

export type Handlers = {
    ftpClient: FTP;
    privateKey: PrivateKey;
    git: Git;
};
