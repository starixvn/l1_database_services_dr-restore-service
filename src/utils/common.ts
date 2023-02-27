import { ListingElement } from "sc-ts-ftp";

type DateTypes = Date | ListingElement;

export function compareDateAsc<K extends DateTypes>(op1: K, op2: K): number {
    if ("date" in op1 && "date" in op2) {
        return op1.date.valueOf() - op2.date.valueOf();
    }
    if (op1 instanceof Date && op2 instanceof Date) {
        return op1.valueOf() - op2.valueOf();
    }
    return 0;
}

export function compareDateDesc<K extends DateTypes>(op1: K, op2: K): number {
    return -compareDateAsc(op1, op2);
}

export function updatePatchTime(file: ListingElement): ListingElement {
    const namePattern = /([0-9]{4})-(Backup|Squash)-at-([0-9]{4}-[0-1][0-9]-[0-3][0-9])-([0-2][0-9])-([0-5][0-9]).patch.gpg$/;
    const nameParsed = namePattern.exec(file.name);
    if (nameParsed) {
        file.date = new Date(`${nameParsed[3]}T${nameParsed[4]}:${nameParsed[5]}Z`);
    }

    return file;
}
