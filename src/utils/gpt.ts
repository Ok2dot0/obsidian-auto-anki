import OpenAI from 'openai';
import type {
    ChatCompletion,
    ChatCompletionCreateParams,
    ChatCompletionUserMessageParam,
    ChatCompletionAssistantMessageParam,
    ChatCompletionSystemMessageParam,
} from 'openai/resources';
import { App, TFile } from 'obsidian';
import logger from 'src/logger';
import { GptAdvancedOptions, AIProvider, MultimodalSettings } from 'src/settings';
import { processImages, stripImageMarkdown, ImageInfo, processStandaloneFile } from './image-utils';

export interface CardInformation {
    q: string;
    a: string;
}

export function checkAI(provider: AIProvider, apiKey: string, baseUrl?: string) {
    if (provider === 'openai') {
        // check gpt api key
        if (apiKey === '') {
            logger.log({
                level: 'error',
                message: "OpenAI API key not provided! Please go to your 'Auto Anki' settings to set an API key."
            });
            return false;
        }
    } else if (provider === 'ollama') {
        // check ollama base url
        if (!baseUrl || baseUrl === '') {
            logger.log({
                level: 'error',
                message: "Ollama base URL not provided! Please go to your 'Auto Anki' settings to set the Ollama base URL."
            });
            return false;
        }
    }
    return true;
}

// Keep the old function for backwards compatibility
export function checkGpt(openAiKey: string) {
    return checkAI('openai', openAiKey);
}

const SAMPLE_NOTE = `A numeral system is a writing system for expressing numbers. It is a mathematical notation for representing numbers of a given set, using digits or other symbols in a consistent manner.

Ideally, a numeral system will:
- represent a useful set of numbers (eg: integers, rational numbers)
- give every number represented a unique representation
- reflect the algebraic and arithmetic structure of the numbers

#### Positional Notation
> also known as the "place-value notation"

Uses a **radix**/**base** (eg: base 10) to indicate the number of unique *digits* that are used to represent numbers in a position until the position of the digit is used to signify a power of the *base* number.

- Positional Systems with Base 2: [[Binary Numeral System]]
- Positional Systems with Base 8: Octal Numeral System
- Positional Systems with Base 10: Decimal Numeral System
- Positional Systems with Base 12: Duodecimal (dozenal) Numeral System
- Positional Systems with Base 16: Hexadecimal Numeral System
- Positional Systems with Base 20: Vigesimal Numeral System
- Positional Systems with Base 60: Sexagesimal Numeral System
`

const SAMPLE_OUTPUT = [
    { q: 'What is a numeral system?', a: 'A numeral system is a writing system for expressing numbers, using digits or other symbols in a consistent manner.' },
    { q: 'What is the goal of a numeral system?', a: 'The goal of a numeral system is to represent a useful set of numbers (eg: integers, rational numbers), give every number represented a unique representation, and reflect the algebraic and arithmetic structure of the numbers.' },
    { q: 'What is a positional notation also known as?', a: 'Place-value Notation' },
    { q: 'What is a radix/base used for in the context of positional notation?', a: 'To indicate the number of unique digits that are used to represent numbers in a position until the position of the digit is used to signify a power of the base number' },
    { q: 'What numeral system uses a base of 2?', a: 'Binary Numeral System' },
    { q: 'What numeral system uses a base of 8?', a: 'Octal Numeral System' },
    { q: 'What numeral system uses a base of 10?', a: 'Decimal Numeral System' },
    { q: 'What numeral system uses a base of 12?', a: 'Duodecimal Numeral System' },
    { q: 'What numeral system uses a base of 16?', a: 'Hexadecimal Numeral System' },
    { q: 'What numeral system uses a base of 20?', a: 'Vigesimal Numeral System' },
    { q: 'What numeral system uses a base of 60?', a: 'Sexagesimal Numeral System' },
    { q: 'What is binary number representation?', a: 'Binary number representation is a number expressed in the base-2 numeral system or binary numeral system.' },
    // { q: '', a: '' },
]

function generateRepeatedSampleOutput(num: number) {
    if (num < SAMPLE_OUTPUT.length) return SAMPLE_OUTPUT.slice(0, num);

    let count = 0;
    const output = [];
    while (count < num) {
        output.push(...SAMPLE_OUTPUT)
        count += SAMPLE_OUTPUT.length;
    }
    return output.slice(0, num);
}

function createMessages(notes: string, num: number, images?: ImageInfo[]) {
    const messages = [];
    
    // Create system message with multimodal instructions if images are present
    const systemContent = images && images.length > 0 
        ? `You will be provided notes on a specific topic along with images. The notes are formatted in markdown. Based on the given notes and images, make a list of ${num} questions and short answers that can be used for reviewing said notes by spaced repetition. Use the following guidelines:
        - output the questions and answers in the following JSON format { "questions_answers": [{ "q": "<generated question>", "a": "<generated answer>" }] }
        - ensure that the questions cover the entire portion of the given notes and images, do not come up with similar questions or repeat the same questions
        - when referencing images in questions or answers, describe the relevant visual content clearly
        - create questions that test understanding of both textual and visual information where applicable`
        : `You will be provided notes on a specific topic. The notes are formatted in markdown. Based on the given notes, make a list of ${num} questions and short answers that can be used for reviewing said notes by spaced repetition. Use the following guidelines:
        - output the questions and answers in the following JSON format { "questions_answers": [{ "q": "<generated question>", "a": "<generated answer>" }] }
        - ensure that the questions cover the entire portion of the given notes, do not come up with similar questions or repeat the same questions`;

    messages.push({
        role: 'system',
        content: systemContent
    } as ChatCompletionSystemMessageParam)

    // Insert sample user prompt (keeping it text-only for consistency)
    messages.push({
        role: 'user',
        content: SAMPLE_NOTE,
    } as ChatCompletionUserMessageParam);
    
    // Insert sample assistant output (JSON format)
    messages.push({
        role: 'assistant',
        content: JSON.stringify({
            "questions_answers": generateRepeatedSampleOutput(num)
        }),
    } as ChatCompletionAssistantMessageParam);

    console.log({
        "questions_answers": generateRepeatedSampleOutput(num)
    })

    // Create user message with notes and optional images
    if (images && images.length > 0) {
        const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
            {
                type: 'text',
                text: `\n${notes.trim()}\n`
            }
        ];

        // Add images to the content array
        images.forEach(image => {
            content.push({
                type: 'image_url',
                image_url: {
                    url: `data:${image.mimeType};base64,${image.base64}`
                }
            });
        });

        messages.push({
            role: 'user',
            content: content
        } as any); // Using any to work around OpenAI SDK type constraints
    } else {
        // Text-only message
        messages.push({
            role: 'user',
            content: `\n${notes.trim()}\n`,
        } as ChatCompletionUserMessageParam);
    }

    return messages;
}

/**
 * Create messages array for standalone file processing
 */
function createMessagesForStandaloneFile(fileInfo: ImageInfo, num_q: number): Array<ChatCompletionSystemMessageParam | ChatCompletionUserMessageParam | ChatCompletionAssistantMessageParam> {
    const messages: Array<ChatCompletionSystemMessageParam | ChatCompletionUserMessageParam | ChatCompletionAssistantMessageParam> = [];

    const num = 1; // For standalone files, typically generate one set of questions
    
    // System message for standalone file processing
    messages.push({
        role: 'system',
        content: `You are a helpful assistant designed to generate comprehensive flashcard questions and answers from visual content (images, PDFs, etc.). 

Your task is to:
1. Analyze the provided file content carefully
2. Generate ${num_q} high-quality questions that test understanding of the visual content
3. Provide clear, accurate answers
4. Focus on key concepts, details, and information visible in the file
5. Make questions specific to what can be observed in the content

Format your response as a JSON object with this exact structure:
{
    "questions_answers": [
        {"q": "Your question here", "a": "Your answer here"}
    ]
}

Important guidelines:
- Questions should be clear and specific to the visual content
- Answers should be comprehensive but concise
- Focus on educational value
- Ensure questions test different aspects of the content (if applicable)
- For images: focus on visible elements, diagrams, text, concepts shown
- For PDFs: focus on key information, structure, main points
`,
    } as ChatCompletionSystemMessageParam);

    // Add sample output
    messages.push({
        role: 'assistant',
        content: JSON.stringify({
            "questions_answers": generateRepeatedSampleOutput(num)
        }),
    } as ChatCompletionAssistantMessageParam);

    // Create user message with the file
    const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
        {
            type: 'text',
            text: `Please analyze this file and generate ${num_q} educational flashcard questions and answers based on its content: ${fileInfo.alt || fileInfo.path}`
        },
        {
            type: 'image_url',
            image_url: {
                url: `data:${fileInfo.mimeType};base64,${fileInfo.base64}`
            }
        }
    ];

    messages.push({
        role: 'user',
        content: content
    } as any);

    return messages;
}
  
export async function convertNotesToFlashcards(
    app: App,
    provider: AIProvider,
    apiKey: string,
    notes: string,
    num_q: number,
    num: number,
    options: GptAdvancedOptions,
    baseUrl?: string,
    model?: string,
    multimodalSettings?: MultimodalSettings,
) {
    let response: ChatCompletion;
    let processedImages: ImageInfo[] = [];
    let processedNotes = notes;

    try {
        // Process images if multimodal is enabled
        if (multimodalSettings && multimodalSettings.enabled) {
            processedImages = await processImages(app, notes, multimodalSettings);
            if (processedImages.length > 0) {
                // Strip image markdown from notes to avoid duplication
                processedNotes = stripImageMarkdown(notes);
                logger.log({
                    level: 'info',
                    message: `Processing ${processedImages.length} images with notes`
                });
            }
        }

        let client: OpenAI;
        let modelToUse: string;

        if (provider === 'openai') {
            client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
            // Use vision model if images are present, otherwise use regular model
            modelToUse = processedImages.length > 0 ? 'gpt-4-vision-preview' : 'gpt-3.5-turbo-1106';
        } else if (provider === 'ollama') {
            client = new OpenAI({ 
                baseURL: baseUrl + '/v1',
                apiKey: 'ollama', // Ollama doesn't require an API key, but the client expects one
                dangerouslyAllowBrowser: true 
            });
            // Use vision model if images are present and multimodal is enabled
            if (processedImages.length > 0 && multimodalSettings?.enabled) {
                modelToUse = multimodalSettings.visionModel;
            } else {
                modelToUse = model || 'llama3.2';
            }
        } else {
            throw new Error(`Unsupported AI provider: ${provider}`);
        }

        const {
            max_tokens_per_question: tokensPerQuestion,
            ...completionOptions
        } = options;
    
        // Create completion params
        const completionParams: ChatCompletionCreateParams = {
            ...completionOptions,
            model: modelToUse,
            messages: createMessages(processedNotes, num_q, processedImages.length > 0 ? processedImages : undefined),
            max_tokens: tokensPerQuestion * num_q,
            n: num,
            stream: false,
        };

        // Only add response_format for OpenAI with text models (vision models may not support it)
        if (provider === 'openai' && processedImages.length === 0) {
            completionParams.response_format = { type: "json_object" };
        }

        response = await client.chat.completions.create(completionParams) as ChatCompletion;
    }
    catch (err) {
        const providerName = provider === 'openai' ? 'OpenAI' : 'Ollama';
        if (!err.response) {
            logger.log({
                level: 'error',
                message: `Could not connect to ${providerName}! ${err.message}`
            });
        }
        else {
            const errStatus = err.response.status;
            const errBody = err.response.data;
            let supportingMessage = `(${errBody.error?.code || 'unknown'}) ${errBody.error?.message || 'Unknown error'}`;
            if (errStatus === 401) {
                if (provider === 'openai') {
                    supportingMessage = 'Check that your API Key is correct/valid!';
                } else {
                    supportingMessage = 'Check that Ollama is running and accessible!';
                }
            }
            logger.log({
                level: 'error',
                message: `ERR ${errStatus}: Could not connect to ${providerName}! ${supportingMessage}`
            });
        }
        return [];
    }

    try {
        const card_choices: Array<CardInformation[]> = [];
        logger.log({
            level: 'info',
            message: `Generated ${response.choices.length} choices!`,
        });

        response.choices.forEach((set, idx) => {
            const content = set.message.content ?? '';
            logger.log({
                level: 'info',
                message: content,
            });
            
            try {
                const parsedContent = JSON.parse(content);
                if(parsedContent["questions_answers"] === undefined) {
                    // Try to extract JSON from markdown code blocks if present
                    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
                    if (jsonMatch) {
                        const jsonContent = JSON.parse(jsonMatch[1]);
                        if (jsonContent["questions_answers"]) {
                            card_choices.push(jsonContent['questions_answers'] as CardInformation[]);
                            return;
                        }
                    }
                    throw new Error("questions_answers not found in response");
                }
                logger.log({
                    level: 'info',
                    message: `Choice ${idx}: generated ${parsedContent["questions_answers"].length} questions and answers`,
                });
                card_choices.push(parsedContent['questions_answers'] as CardInformation[])
            } catch (parseError) {
                logger.log({
                    level: 'warning',
                    message: `Failed to parse response choice ${idx}: ${parseError.message}. Raw content: ${content}`,
                });
            }
        })
        return card_choices;
    }
    catch (err) {
        logger.log({
            level: 'error',
            message: `Something happened while parsing AI output! Please contact a developer for more support.`,
        });
        return [];
    }
}

/**
 * Convert a standalone media file (image, PDF, etc.) to flashcards
 */
export async function convertStandaloneFileToFlashcards(
    app: App,
    provider: AIProvider,
    apiKey: string,
    file: TFile,
    num_q: number,
    num: number,
    options: GptAdvancedOptions,
    baseUrl?: string,
    model?: string,
    multimodalSettings?: MultimodalSettings,
) {
    let response: ChatCompletion;
    let processedFile: ImageInfo | null = null;

    try {
        // Process the standalone file if multimodal is enabled
        if (multimodalSettings && multimodalSettings.enabled) {
            processedFile = await processStandaloneFile(app, file, multimodalSettings);
            if (!processedFile) {
                throw new Error(`Failed to process file: ${file.path}`);
            }
            
            logger.log({
                level: 'info',
                message: `Processing standalone file: ${file.path}`
            });
        } else {
            throw new Error('Multimodal support is not enabled');
        }

        let client: OpenAI;
        let modelToUse: string;

        if (provider === 'openai') {
            client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
            modelToUse = 'gpt-4-vision-preview'; // Always use vision model for files
        } else if (provider === 'ollama') {
            client = new OpenAI({ 
                baseURL: baseUrl + '/v1',
                apiKey: 'ollama',
                dangerouslyAllowBrowser: true 
            });
            modelToUse = multimodalSettings?.visionModel || 'llama3.2-vision:11b';
        } else {
            throw new Error(`Unsupported AI provider: ${provider}`);
        }

        const {
            max_tokens_per_question: tokensPerQuestion,
            ...completionOptions
        } = options;
    
        // Create completion params for standalone file processing
        const completionParams: ChatCompletionCreateParams = {
            ...completionOptions,
            model: modelToUse,
            messages: createMessagesForStandaloneFile(processedFile, num_q),
            max_tokens: tokensPerQuestion * num_q * num,
            stream: false, // Ensure we don't use streaming
        };

        logger.log({
            level: 'info',
            message: `Requesting flashcards for standalone file with model: ${modelToUse}`,
        });

        response = await client.chat.completions.create(completionParams);
        
        logger.log({
            level: 'info',
            message: `Received response for standalone file. Tokens used: ${response.usage?.total_tokens || 'unknown'}`,
        });
    } catch (error) {
        logger.log({
            level: 'error',
            message: `Failed to generate flashcards for standalone file: ${error.message}`,
        });
        throw error;
    }

    // Parse the response
    try {
        const card_choices: CardInformation[][] = [];
        response.choices.forEach((set, idx) => {
            const content = set.message?.content?.trim() || '';
            
            logger.log({
                level: 'debug',
                message: content,
            });
            
            try {
                const parsedContent = JSON.parse(content);
                if(parsedContent["questions_answers"] === undefined) {
                    // Try to extract JSON from markdown code blocks if present
                    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
                    if (jsonMatch) {
                        const jsonContent = JSON.parse(jsonMatch[1]);
                        if (jsonContent["questions_answers"]) {
                            card_choices.push(jsonContent['questions_answers'] as CardInformation[]);
                            return;
                        }
                    }
                    throw new Error("questions_answers not found in response");
                }
                logger.log({
                    level: 'info',
                    message: `Choice ${idx}: generated ${parsedContent["questions_answers"].length} questions and answers for standalone file`,
                });
                card_choices.push(parsedContent['questions_answers'] as CardInformation[])
            } catch (parseError) {
                logger.log({
                    level: 'warning',
                    message: `Failed to parse response choice ${idx}: ${parseError.message}. Raw content: ${content}`,
                });
            }
        })
        return card_choices;
    }
    catch (err) {
        logger.log({
            level: 'error',
            message: `Something happened while parsing AI output for standalone file! Please contact a developer for more support.`,
        });
        return [];
    }
}