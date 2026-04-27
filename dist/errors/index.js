export class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = "NotFoundError";
    }
}
export class UnauthorizedError extends Error {
    constructor(message) {
        super(message);
        this.name = "UnauthorizedError";
    }
}
export class WorkoutPlanNotActiveError extends Error {
    constructor(message) {
        super(message);
        this.name = "WorkoutPlanNotActiveError";
    }
}
export class ConflictError extends Error {
    constructor(message) {
        super(message);
        this.name = "ConflictError";
    }
}
export class SessionAlreadyStartedError extends Error {
    constructor(message) {
        super(message);
        this.name = "SessionAlreadyStartedError";
    }
}
