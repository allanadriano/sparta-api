import { google } from '@ai-sdk/google';
import {
    convertToModelMessages,
    stepCountIs,
    streamText,
    tool,
    UIMessage,
} from "ai";
import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { WeekDay } from "../generated/prisma/enums.js";
import { auth } from "../lib/auth.js";
import { CreateWorkoutPlan } from "../usecases/CreateWorkoutPlan.js";
import { GetUserTrainData } from "../usecases/GetUserTrainData.js";
import { ListWorkoutPlans } from "../usecases/ListWorkoutPlans.js";
import { UpdateWorkoutDay } from "../usecases/UpdateWorkoutDay.js";
import { UpdateWorkoutExercise } from "../usecases/UpdateWorkoutExercise.js";
import { UpdateWorkoutPlan } from "../usecases/UpdateWorkoutPlan.js";
import { UpsertUserTrainData } from "../usecases/UpsertUserTrainData.js";

const SYSTEM_PROMPT = `Você é um personal trainer virtual especialista em montagem de planos de treino personalizados.

## Personalidade
- Tom amigável, motivador e acolhedor.
- Linguagem simples e direta, sem jargões técnicos. Seu público principal são pessoas leigas em musculação.
- Respostas curtas e objetivas.

## Regras de Interação

1. **SEMPRE** chame a tool \`getUserTrainData\` antes de qualquer interação com o usuário. Isso é obrigatório.
2. Se o usuário **não tem dados cadastrados** (retornou null):
   - Pergunte nome, peso (kg), altura (cm) e idade. Opcionalmente, pergunte o % de gordura corporal (inteiro de 0 a 100, onde 100 = 100%), mas deixe claro que não é obrigatório.
   - Faça perguntas simples e diretas, tudo em uma única mensagem.
   - Após receber os dados, salve com a tool \`updateUserTrainData\`. **IMPORTANTE**: converta o peso de kg para gramas (multiplique por 1000) antes de salvar. Se o usuário não souber ou não quiser informar o % de gordura, salve sem esse campo.
3. Se o usuário **já tem dados cadastrados**: cumprimente-o pelo nome de forma amigável.
4. Se o usuário pedir para **remover** o percentual de gordura corporal, chame \`updateUserTrainData\` enviando \`bodyFatPercentage: null\` junto com os demais dados atuais do usuário.

## Atualização de Plano de Treino

Quando o usuário quiser **editar/atualizar** um plano de treino existente:
- **SEMPRE** chame \`getWorkoutPlans\` primeiro para saber os IDs dos planos, dias e exercícios.
- Para renomear o plano: use \`updateWorkoutPlan\`.
- Para alterar um dia (nome, dia da semana, descanso, duração, imagem): use \`updateWorkoutDay\`.
- Para alterar um exercício (nome, ordem, séries, repetições, descanso): use \`updateWorkoutExercise\`.
- Você pode chamar múltiplas tools de update em sequência para aplicar várias alterações.
- **NUNCA** recrie o plano inteiro para fazer uma edição parcial. Use as tools de update.

## Criação de Plano de Treino

Quando o usuário quiser criar um plano de treino:
- Pergunte o objetivo, quantos dias por semana ele pode treinar e se tem restrições físicas ou lesões.
- Poucas perguntas, simples e diretas.
- O plano DEVE ter exatamente 7 dias (MONDAY a SUNDAY).
- Dias sem treino devem ter: \`isRest: true\`, \`exercises: []\`, \`estimatedDurationInSeconds: 0\`.
- Chame a tool \`createWorkoutPlan\` para salvar o plano.

### Divisões de Treino (Splits)

Escolha a divisão adequada com base nos dias disponíveis:
- **2-3 dias/semana**: Full Body ou ABC (A: Peito+Tríceps, B: Costas+Bíceps, C: Pernas+Ombros)
- **4 dias/semana**: Upper/Lower (recomendado, cada grupo 2x/semana) ou ABCD (A: Peito+Tríceps, B: Costas+Bíceps, C: Pernas, D: Ombros+Abdômen)
- **5 dias/semana**: PPLUL — Push/Pull/Legs + Upper/Lower (superior 3x, inferior 2x/semana)
- **6 dias/semana**: PPL 2x — Push/Pull/Legs repetido

### Princípios Gerais de Montagem
- Músculos sinérgicos juntos (peito+tríceps, costas+bíceps)
- Exercícios compostos primeiro, isoladores depois
- 4 a 8 exercícios por sessão
- 3-4 séries por exercício. 8-12 reps (hipertrofia), 4-6 reps (força)
- Descanso entre séries: 60-90s (hipertrofia), 2-3min (compostos pesados)
- Evitar treinar o mesmo grupo muscular em dias consecutivos
- Nomes descritivos para cada dia (ex: "Superior A - Peito e Costas", "Descanso")

### Imagens de Capa (coverImageUrl)

SEMPRE forneça um \`coverImageUrl\` para cada dia de treino. Escolha com base no foco muscular:

**Dias majoritariamente superiores** (peito, costas, ombros, bíceps, tríceps, push, pull, upper, full body):
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO3y8pQ6GBg8iqe9pP2JrHjwd1nfKtVSQskI0v
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOW3fJmqZe4yoUcwvRPQa8kmFprzNiC30hqftL

**Dias majoritariamente inferiores** (pernas, glúteos, quadríceps, posterior, panturrilha, legs, lower):
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOgCHaUgNGronCvXmSzAMs1N3KgLdE5yHT6Ykj
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO85RVu3morROwZk5NPhs1jzH7X8TyEvLUCGxY

Alterne entre as duas opções de cada categoria para variar. Dias de descanso usam imagem de superior.`;

export const aiRoutes = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().route({
        method: "POST",
        url: "/",
        schema: {
            tags: ["AI"],
            summary: "Chat with AI personal trainer",
        },
        handler: async (request, reply) => {
            const session = await auth.api.getSession({
                headers: fromNodeHeaders(request.headers),
            });

            if (!session) {
                return reply.status(401).send({ error: "Unauthorized" });
            }

            const userId = session.user.id;
            const { messages } = request.body as { messages: UIMessage[] };

            const result = streamText({
                model: google("gemini-2.5-flash"),
                system: SYSTEM_PROMPT,
                messages: await convertToModelMessages(messages),
                stopWhen: stepCountIs(10),
                tools: {
                    getUserTrainData: tool({
                        description:
                            "Busca os dados de treino do usuário autenticado (peso, altura, idade, % gordura). Retorna null se não houver dados cadastrados.",
                        inputSchema: z.object({}),
                        execute: async () => {
                            const getUserTrainData = new GetUserTrainData();
                            return getUserTrainData.execute({ userId });
                        },
                    }),
                    updateUserTrainData: tool({
                        description:
                            "Atualiza os dados de treino do usuário autenticado. O peso deve ser em gramas (converter kg * 1000).",
                        inputSchema: z.object({
                            weightInGrams: z
                                .number()
                                .describe("Peso do usuário em gramas (ex: 70kg = 70000)"),
                            heightInCentimeters: z
                                .number()
                                .describe("Altura do usuário em centímetros"),
                            age: z.number().describe("Idade do usuário"),
                            bodyFatPercentage: z
                                .number()
                                .int()
                                .min(0)
                                .max(100)
                                .nullable()
                                .optional()
                                .describe("Percentual de gordura corporal (0 a 100). Envie null para remover o valor."),
                        }),
                        execute: async (params) => {
                            const upsertUserTrainData = new UpsertUserTrainData();
                            return upsertUserTrainData.execute({ userId, ...params });
                        },
                    }),
                    getWorkoutPlans: tool({
                        description:
                            "Lista todos os planos de treino do usuário autenticado.",
                        inputSchema: z.object({}),
                        execute: async () => {
                            const listWorkoutPlans = new ListWorkoutPlans();
                            return listWorkoutPlans.execute({ userId });
                        },
                    }),
                    createWorkoutPlan: tool({
                        description:
                            "Cria um novo plano de treino completo para o usuário.",
                        inputSchema: z.object({
                            name: z.string().describe("Nome do plano de treino"),
                            workoutDays: z
                                .array(
                                    z.object({
                                        name: z
                                            .string()
                                            .describe("Nome do dia (ex: Peito e Tríceps, Descanso)"),
                                        weekDay: z.enum(WeekDay).describe("Dia da semana"),
                                        isRest: z
                                            .boolean()
                                            .describe(
                                                "Se é dia de descanso (true) ou treino (false)"
                                            ),
                                        estimatedDurationInSeconds: z
                                            .number()
                                            .describe(
                                                "Duração estimada em segundos (0 para dias de descanso)"
                                            ),
                                        coverImageUrl: z
                                            .string()
                                            .url()
                                            .describe(
                                                "URL da imagem de capa do dia de treino. Usar as URLs de superior ou inferior conforme o foco muscular do dia."
                                            ),
                                        exercises: z
                                            .array(
                                                z.object({
                                                    order: z
                                                        .number()
                                                        .describe("Ordem do exercício no dia"),
                                                    name: z.string().describe("Nome do exercício"),
                                                    sets: z.number().describe("Número de séries"),
                                                    reps: z.number().describe("Número de repetições"),
                                                    restTimeInSeconds: z
                                                        .number()
                                                        .describe(
                                                            "Tempo de descanso entre séries em segundos"
                                                        ),
                                                })
                                            )
                                            .describe(
                                                "Lista de exercícios (vazia para dias de descanso)"
                                            ),
                                    })
                                )
                                .describe(
                                    "Array com exatamente 7 dias de treino (MONDAY a SUNDAY)"
                                ),
                        }),
                        execute: async (input) => {
                            const createWorkoutPlan = new CreateWorkoutPlan();
                            return createWorkoutPlan.execute({
                                userId,
                                name: input.name,
                                workoutDays: input.workoutDays,
                            });
                        },
                    }),
                    updateWorkoutPlan: tool({
                        description:
                            "Atualiza o nome de um plano de treino existente do usuário.",
                        inputSchema: z.object({
                            workoutPlanId: z.string().describe("ID do plano de treino"),
                            name: z.string().optional().describe("Novo nome do plano"),
                        }),
                        execute: async (input) => {
                            const updateWorkoutPlan = new UpdateWorkoutPlan();
                            return updateWorkoutPlan.execute({
                                userId,
                                workoutPlanId: input.workoutPlanId,
                                name: input.name,
                            });
                        },
                    }),
                    updateWorkoutDay: tool({
                        description:
                            "Atualiza um dia de treino existente. Envie apenas os campos que deseja alterar.",
                        inputSchema: z.object({
                            workoutPlanId: z.string().describe("ID do plano de treino"),
                            workoutDayId: z.string().describe("ID do dia de treino"),
                            name: z.string().optional().describe("Novo nome do dia"),
                            weekDay: z.enum(WeekDay).optional().describe("Novo dia da semana"),
                            isRest: z.boolean().optional().describe("Se é dia de descanso"),
                            estimatedDurationInSeconds: z.number().optional().describe("Nova duração estimada em segundos"),
                            coverImageUrl: z.string().url().optional().describe("Nova URL da imagem de capa"),
                        }),
                        execute: async (input) => {
                            const updateWorkoutDay = new UpdateWorkoutDay();
                            return updateWorkoutDay.execute({
                                userId,
                                workoutPlanId: input.workoutPlanId,
                                workoutDayId: input.workoutDayId,
                                name: input.name,
                                weekDay: input.weekDay,
                                isRest: input.isRest,
                                estimatedDurationInSeconds: input.estimatedDurationInSeconds,
                                coverImageUrl: input.coverImageUrl,
                            });
                        },
                    }),
                    updateWorkoutExercise: tool({
                        description:
                            "Atualiza um exercício existente dentro de um dia de treino. Envie apenas os campos que deseja alterar.",
                        inputSchema: z.object({
                            workoutPlanId: z.string().describe("ID do plano de treino"),
                            workoutDayId: z.string().describe("ID do dia de treino"),
                            exerciseId: z.string().describe("ID do exercício"),
                            name: z.string().optional().describe("Novo nome do exercício"),
                            order: z.number().optional().describe("Nova ordem do exercício"),
                            sets: z.number().optional().describe("Novo número de séries"),
                            reps: z.number().optional().describe("Novo número de repetições"),
                            restTimeInSeconds: z.number().optional().describe("Novo tempo de descanso em segundos"),
                        }),
                        execute: async (input) => {
                            const updateWorkoutExercise = new UpdateWorkoutExercise();
                            return updateWorkoutExercise.execute({
                                userId,
                                workoutPlanId: input.workoutPlanId,
                                workoutDayId: input.workoutDayId,
                                exerciseId: input.exerciseId,
                                name: input.name,
                                order: input.order,
                                sets: input.sets,
                                reps: input.reps,
                                restTimeInSeconds: input.restTimeInSeconds,
                            });
                        },
                    }),
                },
            });

            const response = result.toUIMessageStreamResponse();
            reply.status(response.status);
            response.headers.forEach((value, key) => reply.header(key, value));
            return reply.send(response.body);
        },
    });
};