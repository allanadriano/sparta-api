import { fromNodeHeaders } from "better-auth/node";
import z from "zod";
import { NotFoundError } from "../errors/index.js";
import { auth } from "../lib/auth.js";
import { ErrorSchema, HomeResponseSchema } from "../schemas/index.js";
import { GetHome } from "../usecases/GetHome.js";
export const homeRoutes = async (app) => {
    app.withTypeProvider().route({
        method: "GET",
        url: "/:date",
        schema: {
            operationId: 'getHome',
            tags: ["Home"],
            summary: "Get home page data",
            params: z.object({
                date: z.iso.date(),
            }),
            response: {
                200: HomeResponseSchema,
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
                const getHome = new GetHome();
                const result = await getHome.execute({
                    userId: session.user.id,
                    date: request.params.date,
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
};
