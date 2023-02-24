import { Telegram } from "telegraf";
import { ExtraReplyMessage } from "telegraf/typings/telegram-types";
import { Logger as Console } from "@ldb/logger";
import { TELEGRAM_CONFIG } from "../app-config";

const { API_KEY, CHAT_ID } = TELEGRAM_CONFIG;
const telegramBot = new Telegram(API_KEY);
const defaultChatId = 925798134;

type LogLevel = "trace" | "debug" | "info" | "warn" | "err" | "fatal";

const EMOTICON: Partial<{ [key in LogLevel]: string }> = {
    warn: `⚠️ *${escapeMarkdownV2("-WARNING-")}*`,
    err: `🔥 *${escapeMarkdownV2("--ERROR--")}*`,
    fatal: `☠️ *${escapeMarkdownV2("==FATAL==")}*`,
};

function buildTelegramMessage(level: LogLevel, message?: unknown, label?: string, subject?: string): string {
    const teleLabel = escapeMarkdownV2(label ? `[ DR Restore ${label} ]` : "");
    const teleSubject = escapeMarkdownV2(subject ?? "");
    const teleMessage = message instanceof Error ? escapeMarkdownV2(message.stack ?? message.toString()) : String(message ?? "");

    return [[EMOTICON[level]].filter(Boolean).join(""), [teleLabel, teleSubject].filter(Boolean).join(" \\- "), teleMessage].filter(Boolean).join("\n");
}

export function escapeMarkdownV2(input: string): string {
    return input.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$&");
}

export class Logger {
    telegram: Telegram;
    chatId: number | string;

    constructor(chatId?: number | string) {
        this.telegram = telegramBot;
        this.chatId = chatId ?? defaultChatId;
    }

    async log<L extends LogLevel>(level: L, message?: unknown, label?: string, subject?: string) {
        const tasks: Promise<any>[] = [];
        tasks.push(Console[level](message, label, subject));

        if (["warn", "err", "fatal"].includes(level)) {
            const sendOptions: ExtraReplyMessage = { parse_mode: "MarkdownV2" };
            tasks.push(this.telegram.sendMessage(this.chatId, buildTelegramMessage(level, message, label, subject), sendOptions));
        }

        return Promise.allSettled(tasks);
    }

    async trace(message?: unknown, label?: string, subject?: string) {
        return this.log("trace", message, label, subject);
    }

    async debug(message?: unknown, label?: string, subject?: string) {
        return this.log("debug", message, label, subject);
    }

    async info(message?: unknown, label?: string, subject?: string) {
        return this.log("info", message, label, subject);
    }

    async warn(message?: unknown, label?: string, subject?: string) {
        return this.log("warn", message, label, subject);
    }

    async err(message?: unknown, label?: string, subject?: string) {
        return this.log("err", message, label, subject);
    }

    async fatal(message?: unknown, label?: string, subject?: string) {
        return this.log("fatal", message, label, subject);
    }
}

export const logger = new Logger(CHAT_ID);
