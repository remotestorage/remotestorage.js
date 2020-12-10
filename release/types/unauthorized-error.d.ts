declare class UnauthorizedError extends Error {
    code: string;
    constructor(message?: string, options?: {
        code?: string;
    });
}
export = UnauthorizedError;
//# sourceMappingURL=unauthorized-error.d.ts.map