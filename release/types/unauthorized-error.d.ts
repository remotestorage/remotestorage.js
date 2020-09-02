export default class UnauthorizedError extends Error {
    code: string;
    constructor(message?: string, options?: {
        code?: string;
    });
}
