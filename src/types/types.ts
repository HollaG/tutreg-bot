import db from "mysql2/promise";
export interface ClassSwapRequest extends TelegramUser {
    swapId: number;
    moduleCode: string;
    lessonType: string;
    classNo: string;
    from_t_id: number;
    status: "Open" | "Completed" | "Reserved";
    requestors: string; // csv of telegram ids
    to_t_id: number | null;
    requested: ClassOverview[];
    ay: string;
    semester: number;
    createdAt: Date;
}

export interface ClassSwapRequestDB extends db.RowDataPacket {
    swapId: number;
    moduleCode: string;
    lessonType: string;
    classNo: string;
    from_t_id: number;
    status: "Open" | "Completed" | "Reserved";
    requestors: string; // csv of telegram ids
    to_t_id: number | null;
    ay: string;
    semester: number;
    createdAt: Date;
}

export type ClassSwapFor = {
    rowId: number;
    wantedClassNo: string;
    wantedModuleCode: string;
    wantedLessonType: string;
    swapId: number;
};

export interface TelegramUser extends db.RowDataPacket {
    id: number;
    first_name: string;
    username: string;
    photo_url: string;
    auth_date: number;
    hash: string;
}

export type ClassOverview = {
    classNo: string;
    moduleCode: string;
    lessonType: string;
    moduleName: string;
    size: number;
    classes: ModuleWithClassDB[];
};

export type ModuleDB = {
    moduleCode: string;
    moduleName: string;
    lastUpdated: Date;
};
export type ClassDB = {
    uniqueClassId: number;
    moduleCode: string;
    venue: string;
    lessonType: "Tutorial" | "Lecture" | "Sectional" | "Lab";
    classNo: string;
    startTime: string;
    endTime: string;
    weeks: number[];
    lastUpdated: Date;
    ay: string;
    sem: number;
    size: number;
    day: string;
};

export type ModuleWithClassDB = ClassDB & ModuleDB;

export interface SwapToNotify {
    swap: ClassSwapRequest;
    newRequestors: string[];
    removedRequestors: string[];
    unchangedRequestors: string[];
}

export interface ExtendedUser extends TelegramUser {
    can_notify: boolean;
}

export type HalfInfo = {
    moduleCode: string;
    lessonType: string;
};
export type FullInfo = HalfInfo & {
    classNo: string;
};

export type Request = FullInfo & {
    status: "new" | "notified" | "deleted";
};
export type SwapReplyRequest = {
    requestorId: number; // Telegram id
    requested: Request[];
    lastUpdated: Date;
};

export interface SwapReplies {
    swapId: number;
    requests: SwapReplyRequest[];
}
