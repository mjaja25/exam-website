// Mock dependencies before requiring the module
jest.mock('@google/generative-ai', () => {
    const mockGenerateContent = jest.fn();
    return {
        GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
            getGenerativeModel: jest.fn().mockReturnValue({
                generateContent: mockGenerateContent
            })
        })),
        __mockGenerateContent: mockGenerateContent
    };
});

jest.mock('exceljs', () => {
    const mockGetSheetValues = jest.fn();
    return {
        Workbook: jest.fn().mockImplementation(() => ({
            xlsx: {
                load: jest.fn().mockResolvedValue(true)
            },
            getWorksheet: jest.fn().mockImplementation((index) => {
                if (index === 1) return { getSheetValues: mockGetSheetValues };
                if (index === 2) return { getSheetValues: mockGetSheetValues };
                return null;
            })
        })),
        __mockGetSheetValues: mockGetSheetValues
    };
});

jest.mock('axios', () => ({
    get: jest.fn().mockResolvedValue({
        data: Buffer.alloc(100)
    })
}));

const { __mockGenerateContent } = require('@google/generative-ai');
const aiGradingService = require('../../services/aiGradingService');

describe('gradeLetter', () => {
    beforeEach(() => {
        __mockGenerateContent.mockReset();
    });

    test('should grade a letter with AI and deterministic checks', async () => {
        const aiResponse = {
            content: { score: 3, explanation: 'Well written content.' },
            format: { score: 2, explanation: 'Good layout.' },
            presentation: { score: 1, explanation: 'Clean presentation.' }
        };

        __mockGenerateContent.mockResolvedValue({
            response: {
                text: () => JSON.stringify(aiResponse)
            }
        });

        // Content with correct formatting
        const content = '<span style="font-family: Times New Roman; font-size: 12pt;">Dear Sir, <u>Subject: Test</u></span>';
        const result = await aiGradingService.gradeLetter(content, 'Write a formal letter');

        expect(result).toHaveProperty('totalScore');
        expect(result).toHaveProperty('feedback');
        expect(result).toHaveProperty('scores');
        expect(result.scores.content).toBeLessThanOrEqual(3);
        expect(result.scores.format).toBeLessThanOrEqual(2);
        expect(result.scores.presentation).toBeLessThanOrEqual(1);
        expect(result.totalScore).toBeLessThanOrEqual(10);
        expect(result.totalScore).toBeGreaterThanOrEqual(0);
    });

    test('should detect Times New Roman font', async () => {
        const aiResponse = {
            content: { score: 2, explanation: 'Decent.' },
            format: { score: 1, explanation: 'Ok.' },
            presentation: { score: 1, explanation: 'Fine.' }
        };

        __mockGenerateContent.mockResolvedValue({
            response: { text: () => JSON.stringify(aiResponse) }
        });

        // With Times New Roman
        const contentWithFont = '<span style="font-family: Times New Roman;">Letter content</span>';
        const result = await aiGradingService.gradeLetter(contentWithFont, 'Test question');

        expect(result.scores.typography).toBeGreaterThanOrEqual(1);
    });

    test('should detect subject bold and underline', async () => {
        const aiResponse = {
            content: { score: 2, explanation: 'Ok.' },
            format: { score: 1, explanation: 'Ok.' },
            presentation: { score: 1, explanation: 'Ok.' }
        };

        __mockGenerateContent.mockResolvedValue({
            response: { text: () => JSON.stringify(aiResponse) }
        });

        const content = '<b>Subject: Test</b> <u>Subject: Test</u>';
        const result = await aiGradingService.gradeLetter(content, 'Test');

        expect(result.scores.subject).toBe(2);
    });

    test('should cap scores to their maximums', async () => {
        const aiResponse = {
            content: { score: 99, explanation: 'Overflow.' },
            format: { score: 99, explanation: 'Overflow.' },
            presentation: { score: 99, explanation: 'Overflow.' }
        };

        __mockGenerateContent.mockResolvedValue({
            response: { text: () => JSON.stringify(aiResponse) }
        });

        const result = await aiGradingService.gradeLetter('Content', 'Test');

        expect(result.scores.content).toBe(3); // Capped at 3
        expect(result.scores.format).toBe(2);  // Capped at 2
        expect(result.scores.presentation).toBe(1); // Capped at 1
        expect(result.totalScore).toBeLessThanOrEqual(10);
    });

    test('should throw on AI API failure', async () => {
        __mockGenerateContent.mockRejectedValue(new Error('API Error'));

        await expect(
            aiGradingService.gradeLetter('Content', 'Question')
        ).rejects.toThrow('AI grading service temporarily unavailable');
    });

    test('should throw on invalid JSON response from AI', async () => {
        __mockGenerateContent.mockResolvedValue({
            response: { text: () => 'not valid json at all' }
        });

        await expect(
            aiGradingService.gradeLetter('Content', 'Question')
        ).rejects.toThrow('AI evaluation failed');
    });

    test('should handle markdown-wrapped JSON response', async () => {
        const aiResponse = {
            content: { score: 2, explanation: 'Good.' },
            format: { score: 1, explanation: 'Fine.' },
            presentation: { score: 1, explanation: 'Ok.' }
        };

        __mockGenerateContent.mockResolvedValue({
            response: { text: () => '```json\n' + JSON.stringify(aiResponse) + '\n```' }
        });

        const result = await aiGradingService.gradeLetter('Content', 'Question');

        expect(result.scores.content).toBe(2);
    });
});

describe('gradeExcel', () => {
    beforeEach(() => {
        __mockGenerateContent.mockReset();
    });

    test('should return score and feedback for valid submission', async () => {
        __mockGenerateContent.mockResolvedValue({
            response: {
                text: () => JSON.stringify({
                    score: 16,
                    feedback: '1. Good formula usage\n2. Correct formatting'
                })
            }
        });

        const result = await aiGradingService.gradeExcel(
            'http://cloud.com/user-file.xlsx',
            'http://cloud.com/solution.xlsx',
            'Basic Excel Test'
        );

        expect(result.score).toBe(16);
        expect(result.feedback).toContain('formula');
    });

    test('should return fallback on AI parse failure', async () => {
        __mockGenerateContent.mockResolvedValue({
            response: { text: () => 'unparseable garbage' }
        });

        const result = await aiGradingService.gradeExcel(
            'http://cloud.com/user.xlsx',
            'http://cloud.com/solution.xlsx',
            'Test'
        );

        expect(result.score).toBe(0);
        expect(result.feedback).toContain('failed');
    });
});

describe('analyzePerformance', () => {
    beforeEach(() => {
        __mockGenerateContent.mockReset();
    });

    test('should analyze typing performance', async () => {
        const analysisResponse = {
            strengths: [{ title: 'Good speed', detail: 'Above average' }],
            improvements: [{ title: 'Accuracy', detail: 'Some errors', suggestion: 'Practice more' }],
            tips: [{ text: 'Focus on rhythm' }]
        };

        __mockGenerateContent.mockResolvedValue({
            response: { text: () => JSON.stringify(analysisResponse) }
        });

        const result = await aiGradingService.analyzePerformance(
            { wpm: 45, accuracy: 92, typingDuration: 600 },
            'typing'
        );

        expect(result.strengths).toHaveLength(1);
        expect(result.improvements).toHaveLength(1);
        expect(result.tips).toHaveLength(1);
    });

    test('should analyze letter performance', async () => {
        const analysisResponse = {
            strengths: [{ title: 'Good structure', detail: 'Well organized' }],
            improvements: [{ title: 'Vocabulary', detail: 'Limited', suggestion: 'Read more' }],
            tips: [{ text: 'Practice daily' }],
            sampleStructure: 'Date, Address, Salutation, Body, Closing'
        };

        __mockGenerateContent.mockResolvedValue({
            response: { text: () => JSON.stringify(analysisResponse) }
        });

        const result = await aiGradingService.analyzePerformance(
            { letterContent: '<p>Dear Sir...</p>', letterFeedback: 'Content: 2/3' },
            'letter'
        );

        expect(result.sampleStructure).toBeDefined();
    });

    test('should throw for letter analysis without content', async () => {
        await expect(
            aiGradingService.analyzePerformance({}, 'letter')
        ).rejects.toThrow('No letter content found');
    });

    test('should throw for invalid analysis type', async () => {
        await expect(
            aiGradingService.analyzePerformance({}, 'invalid_type')
        ).rejects.toThrow('Invalid analysis type');
    });

    test('should throw on unparseable AI response', async () => {
        __mockGenerateContent.mockResolvedValue({
            response: { text: () => 'bad json' }
        });

        await expect(
            aiGradingService.analyzePerformance({ wpm: 30, accuracy: 90 }, 'typing')
        ).rejects.toThrow('Failed to parse');
    });
});
