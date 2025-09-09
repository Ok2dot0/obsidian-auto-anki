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
        'webp': 'image/webp'
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

            // Find the file in the vault
            const file = app.vault.getAbstractFileByPath(imagePath) as TFile;
            if (!file || !(file instanceof TFile)) {
                // Try to find the file by name if direct path doesn't work
                const allFiles = app.vault.getFiles();
                const foundFile = allFiles.find(f => f.name === imagePath || f.path.endsWith(imagePath));
                
                if (!foundFile) {
                    logger.log({
                        level: 'warning',
                        message: `Image file not found: ${imagePath}`
                    });
                    continue;
                }
                
                imagePath = foundFile.path;
            }

            const imageFile = app.vault.getAbstractFileByPath(imagePath) as TFile;
            
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
 * Remove image markdown syntax from text to avoid duplicate processing
 */
export function stripImageMarkdown(markdownText: string): string {
    // Replace image markdown with alt text or placeholder
    return markdownText.replace(IMAGE_REGEX, (match, alt, path) => {
        // If there's alt text, keep it; otherwise use a placeholder
        return alt || `[Image: ${path}]`;
    });
}