import { App, TFile } from 'obsidian';
import { MultimodalSettings } from '../settings';
import logger from '../logger';

export interface ImageInfo {
    path: string;
    base64: string;
    mimeType: string;
    alt?: string;
}

// Regular expression to match markdown image syntax: ![alt text](path)
const IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;

/**
 * Extract image references from markdown text
 */
export function extractImageReferences(markdownText: string): Array<{ alt: string; path: string }> {
    const images: Array<{ alt: string; path: string }> = [];
    let match;
    
    while ((match = IMAGE_REGEX.exec(markdownText)) !== null) {
        const [, alt, path] = match;
        images.push({ alt: alt || '', path });
    }
    
    return images;
}

/**
 * Get MIME type from file extension
 */
function getMimeType(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'bmp': 'image/bmp',
        'webp': 'image/webp',
        'pdf': 'application/pdf'
    };
    
    return mimeTypes[extension.toLowerCase()] || 'image/jpeg';
}

/**
 * Check if file extension is supported for multimodal processing
 */
function isSupportedImageFormat(path: string, supportedFormats: string[]): boolean {
    const extension = path.split('.').pop()?.toLowerCase();
    return extension ? supportedFormats.includes(extension) : false;
}

/**
 * Check if a file is a supported media format (images, PDFs, etc.)
 */
export function isSupportedMediaFormat(path: string, supportedFormats: string[]): boolean {
    return isSupportedImageFormat(path, supportedFormats);
}

/**
 * Get all supported media file extensions
 */
export function getAllSupportedExtensions(): string[] {
    return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'pdf'];
}

/**
 * Convert file size from bytes to KB
 */
function bytesToKB(bytes: number): number {
    return bytes / 1024;
}

/**
 * Process images referenced in markdown text and convert them to base64
 */
export async function processImages(
    app: App,
    markdownText: string,
    multimodalSettings: MultimodalSettings
): Promise<ImageInfo[]> {
    if (!multimodalSettings.enabled) {
        return [];
    }

    const imageReferences = extractImageReferences(markdownText);
    const processedImages: ImageInfo[] = [];

    for (const imageRef of imageReferences) {
        try {
            // Handle both absolute and relative paths
            let imagePath = imageRef.path;
            
            // If it's a web URL, skip it (we only process local files)
            if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
                logger.log({
                    level: 'info',
                    message: `Skipping web image: ${imagePath}`
                });
                continue;
            }

            // Check if format is supported
            if (!isSupportedImageFormat(imagePath, multimodalSettings.supportedFormats)) {
                logger.log({
                    level: 'warning',
                    message: `Unsupported image format: ${imagePath}`
                });
                continue;
            }

            // Find the file in the vault - improved path resolution
            let imageFile: TFile | null = null;
            
            // Try direct path first
            const directFile = app.vault.getAbstractFileByPath(imagePath) as TFile;
            if (directFile && directFile instanceof TFile) {
                imageFile = directFile;
            } else {
                // Try to find the file by name or partial path
                const allFiles = app.vault.getFiles();
                
                // First, try exact name match
                let foundFile = allFiles.find(f => f.name === imagePath);
                
                // If not found, try files that end with the path
                if (!foundFile) {
                    foundFile = allFiles.find(f => f.path.endsWith(imagePath));
                }
                
                // If still not found, try basename match
                if (!foundFile) {
                    const imageName = imagePath.split('/').pop() || imagePath;
                    foundFile = allFiles.find(f => f.name === imageName);
                }
                
                if (foundFile) {
                    imageFile = foundFile;
                    imagePath = foundFile.path; // Update path to the correct one
                }
            }

            if (!imageFile) {
                logger.log({
                    level: 'warning',
                    message: `Image file not found: ${imageRef.path}. Tried: direct path, name match, path ending, basename match.`
                });
                continue;
            }
            
            // Check file size
            if (bytesToKB(imageFile.stat.size) > multimodalSettings.maxImageSize) {
                logger.log({
                    level: 'warning',
                    message: `Image too large (${Math.round(bytesToKB(imageFile.stat.size))}KB): ${imagePath}`
                });
                continue;
            }

            // Read and convert to base64
            const arrayBuffer = await app.vault.readBinary(imageFile);
            const uint8Array = new Uint8Array(arrayBuffer);
            const base64 = btoa(String.fromCharCode(...uint8Array));
            
            const extension = imagePath.split('.').pop()?.toLowerCase() || 'jpeg';
            const mimeType = getMimeType(extension);

            processedImages.push({
                path: imagePath,
                base64,
                mimeType,
                alt: imageRef.alt
            });

            logger.log({
                level: 'info',
                message: `Successfully processed image: ${imagePath} (${Math.round(bytesToKB(imageFile.stat.size))}KB)`
            });

        } catch (error) {
            logger.log({
                level: 'error',
                message: `Error processing image ${imageRef.path}: ${error.message}`
            });
        }
    }

    return processedImages;
}

/**
 * Process a standalone file (image, PDF, etc.) for multimodal processing
 */
export async function processStandaloneFile(
    app: App,
    file: TFile,
    multimodalSettings: MultimodalSettings
): Promise<ImageInfo | null> {
    if (!multimodalSettings.enabled) {
        return null;
    }

    try {
        const filePath = file.path;
        
        // Check if format is supported
        if (!isSupportedMediaFormat(filePath, multimodalSettings.supportedFormats)) {
            logger.log({
                level: 'warning',
                message: `Unsupported file format: ${filePath}`
            });
            return null;
        }

        // Check file size
        if (bytesToKB(file.stat.size) > multimodalSettings.maxImageSize) {
            logger.log({
                level: 'warning',
                message: `File too large (${Math.round(bytesToKB(file.stat.size))}KB): ${filePath}`
            });
            return null;
        }

        // Read and convert to base64
        const arrayBuffer = await app.vault.readBinary(file);
        const uint8Array = new Uint8Array(arrayBuffer);
        const base64 = btoa(String.fromCharCode(...uint8Array));
        
        const extension = filePath.split('.').pop()?.toLowerCase() || 'jpeg';
        const mimeType = getMimeType(extension);

        logger.log({
            level: 'info',
            message: `Successfully processed standalone file: ${filePath} (${Math.round(bytesToKB(file.stat.size))}KB)`
        });

        return {
            path: filePath,
            base64,
            mimeType,
            alt: file.name
        };

    } catch (error) {
        logger.log({
            level: 'error',
            message: `Error processing standalone file ${file.path}: ${error.message}`
        });
        return null;
    }
}

/**
 * Check if the currently active file is a supported media file
 */
export function isActiveFileSupportedMedia(app: App, supportedFormats: string[]): TFile | null {
    const activeFile = app.workspace.getActiveFile();
    if (!activeFile || !(activeFile instanceof TFile)) {
        return null;
    }
    
    if (isSupportedMediaFormat(activeFile.path, supportedFormats)) {
        return activeFile;
    }
    
    return null;
}
/**
 * Remove image markdown syntax from text to avoid duplicate processing
 */
export function stripImageMarkdown(markdownText: string): string {
    // Replace image markdown with alt text or placeholder
    return markdownText.replace(IMAGE_REGEX, (match, alt, path) => {
        // If there's alt text, keep it; otherwise use a placeholder
        return alt || `[Image: ${path}]`;
    });
}