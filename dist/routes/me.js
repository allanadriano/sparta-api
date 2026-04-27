import { fromNodeHeaders } from "better-auth/node";
import { NotFoundError } from "../errors/index.js";
import { auth } from "../lib/auth.js";
import { ErrorSchema, GetUserTrainDataResponseSchema, UserTrainDataSchema, } from "../schemas/index.js";
import { GetUserTrainData } from "../usecases/GetUserTrainData.js";
import { UpsertUserTrainData } from "../usecases/UpsertUserTrainData.js";
export const meRoutes = async (app) => {
    app.withTypeProvider().route({
        method: "GET",
        url: "/",
        schema: {
            operationId: 'getUserTrainData',
            tags: ["Me"],
            summary: "Get user train data",
            response: {
                200: GetUserTrainDataResponseSchema.nullable(),
                401: ErrorSchema,
                404: ErrorSchema,
                500: ErrorSchema,
            },
        },
        handler: async (request, reply) => {
            try {
                const session = await auth.api.getSession({
                    headers: fromNodeHeaders(request.headers),
                });
                if (!session) {
                    return reply.status(401).send({
                        error: "Unauthorized",
                        code: "UNAUTHORIZED",
                    });
                }
                const getUserTrainData = new GetUserTrainData();
                const result = await getUserTrainData.execute({
                    userId: session.user.id,
                });
                return reply.status(200).send(result);
            }
            catch (error) {
                app.log.error(error);
                if (error instanceof NotFoundError) {
                    return reply.status(404).send({
                        error: error.message,
                        code: "NOT_FOUND_ERROR",
                    });
                }
                return reply.status(500).send({
                    error: "Internal server error",
                    code: "INTERNAL_SERVER_ERROR",
                });
            }
        },
    });
    app.withTypeProvider().route({
        method: "PUT",
        url: "/",
        schema: {
            operationId: 'upsertUserTrainData',
            tags: ["Me"],
            summary: "Upsert user train data",
            body: UserTrainDataSchema.omit({ userId: true }),
            response: {
                200: UserTrainDataSchema,
                401: ErrorSchema,
                500: ErrorSchema,
            },
        },
        handler: async (request, reply) => {
            try {
                const session = await auth.api.getSession({
                    headers: fromNodeHeaders(request.headers),
                });
                if (!session) {
                    return reply.status(401).send({
                        error: "Unauthorized",
                        code: "UNAUTHORIZED",
                    });
                }
                const upsertUserTrainData = new UpsertUserTrainData();
                const result = await upsertUserTrainData.execute({
                    userId: session.user.id,
                    weightInGrams: request.body.weightInGrams,
                    heightInCentimeters: request.body.heightInCentimeters,
                    age: request.body.age,
                    ...(request.body.bodyFatPercentage !== undefined && {
                        bodyFatPercentage: request.body.bodyFatPercentage,
                    }),
                });
                return reply.status(200).send(result);
            }
            catch (error) {
                app.log.error(error);
                return reply.status(500).send({
                    error: "Internal server error",
                    code: "INTERNAL_SERVER_ERROR",
                });
            }
        },
    });
};
