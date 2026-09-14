/**
 * FUTURE USE — itinerary questionnaire / Q&A flow.
 *
 * Not wired to HTTP routes. The live product generates itineraries in one
 * shot via POST /api/plan/generate. Keep this module if we later ask follow-up
 * questions before generating.
 */
import { itineraryAI } from "./itinerary.ai.service.js";
import { itineraryRepository } from "./itinerary.repository.js";

function calculateDays(startDate: string, endDate: string): number {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    const diff = Math.floor((end.getTime() - start.getTime()) / 86400000);
    return Math.max(1, diff + 1);
}

export const itineraryQuestionnaire = {
    async generateQuestions(input: any, userId: string): Promise<{ questions: any[]; itineraryId: string }> {
        const { questions } = await itineraryAI.generateQuestions(input, userId);
        const days = calculateDays(input.startDate, input.endDate);

        const draft = await itineraryRepository.create(userId, {
            title: `Trip to ${input.destination} (Planning)`,
            destination: input.destination,
            startDate: input.startDate,
            endDate: input.endDate,
            totalDays: days,
            currency: "INR",
            itineraryData: {} as any,
            userAnswers: input.previousAnswers || {},
            status: "draft",
        });

        await itineraryRepository.saveQuestions(
            draft.id,
            questions.map((q: any) => ({
                itineraryId: draft.id,
                step: q.step,
                question: q.question,
                questionType: q.questionType,
                options: q.options || null,
                answer: null,
                isRequired: q.isRequired,
            })),
        );

        return { questions, itineraryId: draft.id };
    },

    async submitAnswer(itineraryId: string, step: number, answer: unknown, userId: string): Promise<any | null> {
        const existing = await itineraryRepository.findByIdForUser(itineraryId, userId);
        if (!existing) return null;

        await itineraryRepository.saveAnswer(itineraryId, step, answer);
        const questions = await itineraryRepository.getQuestionsByItineraryId(itineraryId);

        const userAnswers: Record<string, any> = {};
        questions.forEach((question: any) => {
            if (question.answer !== null && question.answer !== undefined) {
                userAnswers[`step_${question.step}`] = question.answer;
            }
        });

        await itineraryRepository.updateForUser(itineraryId, userId, { userAnswers });

        const updatedQuestion = questions.find((question: any) => question.step === step);
        if (!updatedQuestion) return null;

        return {
            id: updatedQuestion.id,
            step: updatedQuestion.step,
            question: updatedQuestion.question,
            questionType: updatedQuestion.questionType,
            options: updatedQuestion.options,
            answer: updatedQuestion.answer,
            isRequired: updatedQuestion.isRequired,
        };
    },
};
