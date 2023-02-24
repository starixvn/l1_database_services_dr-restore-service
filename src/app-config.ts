import { Options } from "sc-ts-ftp";
import { SystemTarget, TelegramConfig } from "./interfaces";

export const FTP_CONFIG: Options = {
    host: "ftp.nexdev.net",
    user: "ftpuser",
    password: "LuM1%Ept1P",
};

export const PRIVATE_KEY_PATH = "./secrets/private-key";

const ftpPatchFolder = "/LUM/patches";
const localPatchFolder = "./files/patch";
const gitPatchFolder = "./files/git";
export const TARGETS: { [f: string]: SystemTarget } = {
    l1: {
        ftpPath: `${ftpPatchFolder}/l1`,
        localPath: `${localPatchFolder}/l1`,
        gitPath: `${gitPatchFolder}/l1`,
    },
    l2: {
        ftpPath: `${ftpPatchFolder}/l2`,
        localPath: `${localPatchFolder}/l2`,
        gitPath: `${gitPatchFolder}/l2`,
    },
    l3: {
        ftpPath: `${ftpPatchFolder}/l3`,
        localPath: `${localPatchFolder}/l3`,
        gitPath: `${gitPatchFolder}/l3`,
    },
};

export const TELEGRAM_CONFIG: TelegramConfig = {
    API_KEY: "5405966017:AAH2jbB8PDs5KWeXKdZzQVwQgJOaE6wNYAA",
    CHAT_ID: undefined,
};
