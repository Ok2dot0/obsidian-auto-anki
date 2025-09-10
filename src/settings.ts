import { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions';
import { ANKI_CONNECT_DEFAULT_PORT } from './utils/anki';

export interface GptAdvancedOptions extends Partial<ChatCompletionCreateParamsBase> {
	temperature: number;
	top_p: number;
	frequency_penalty: number;
	presence_penalty: number;
	max_tokens_per_question: number;
}

export interface QuestionGenerationDefaults {
	textSelection: {
		numQuestions: number,
		numAlternatives: number,
	},
	file: {
		numQuestions: number,
		numAlternatives: number,
	},
}

export type AIProvider = 'openai' | 'ollama';

export interface MultimodalSettings {
	enabled: boolean;
	visionModel: string;
	maxImageSize: number; // in KB
	supportedFormats: string[];
}

export interface PluginSettings {
	ankiConnectPort: number;
	ankiDestinationDeck: string;
	aiProvider: AIProvider;
	openAiApiKey: string | null;
	openAiApiKeyIdentifier: string;
	ollamaBaseUrl: string;
	ollamaModel: string;
	multimodal: MultimodalSettings;
	gptAdvancedOptions: GptAdvancedOptions;
	questionGenerationDefaults: QuestionGenerationDefaults;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	ankiConnectPort: ANKI_CONNECT_DEFAULT_PORT,
	ankiDestinationDeck: '',
	aiProvider: 'openai',
	openAiApiKey: null,
	openAiApiKeyIdentifier: '',
	ollamaBaseUrl: 'http://localhost:11434',
	ollamaModel: 'llama3.2',
	multimodal: {
		enabled: false,
		visionModel: 'llama3.2-vision:11b',
		maxImageSize: 5000, // 5MB in KB
		supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
	},
	gptAdvancedOptions: {
		temperature: 1,
		top_p: 1.0,
		frequency_penalty: 0.0,
		presence_penalty: 0.0,
		max_tokens_per_question: 100,
	},
	questionGenerationDefaults: {
		textSelection: {
			numQuestions: 1,
			numAlternatives: 0,
		},
		file: {
			numQuestions: 5,
			numAlternatives: 0,
		},
	},
}
