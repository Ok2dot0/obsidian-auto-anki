# Multimodal Support Guide

This guide explains how to use the multimodal (vision) capabilities in Auto Anki with Llama 3.2 Vision and other vision models.

## Prerequisites

### For Ollama Users
1. **Install Ollama** if not already installed: [ollama.ai](https://ollama.ai/)
2. **Pull a vision model**:
   ```bash
   ollama pull llama3.2-vision:11b
   # or for the larger model
   ollama pull llama3.2-vision:90b
   ```
3. **Start Ollama**: `ollama serve`

### For OpenAI Users
- Ensure you have access to GPT-4 Vision (gpt-4-vision-preview) in your OpenAI account

## Configuration

1. **Open Plugin Settings**: Go to Settings → Community Plugins → Auto Anki
2. **Enable Multimodal Support**: 
   - Toggle "Enable Multimodal Support" to ON
3. **Configure Vision Model**:
   - For Ollama: Set "Vision Model" to `llama3.2-vision:11b` or `llama3.2-vision:90b`
   - For OpenAI: The plugin automatically uses `gpt-4-vision-preview` when images are detected
4. **Adjust Settings** (optional):
   - **Max Image Size**: Default is 5MB (5000 KB). Reduce if you encounter memory issues
   - **Supported Formats**: jpg, jpeg, png, gif, bmp, webp are supported by default

## Usage

### Basic Usage
1. Create or open a note in Obsidian that contains both text and images
2. Include images using standard markdown syntax: `![Alt text](path/to/image.png)`
3. Use the Auto Anki commands as normal:
   - "Export Current File to Anki" - processes the entire file
   - "Export Highlighted Text to Anki" - processes selected text

### Example Note Structure
```markdown
# Machine Learning Concepts

## Neural Networks
Neural networks are computing systems inspired by biological neural networks.

![Neural Network Diagram](images/neural-network.png)

Key components include:
- Input layer
- Hidden layers  
- Output layer

## Training Process
The training involves forward and backward propagation.

![Training Chart](charts/training-loss.jpg)

The loss decreases as the model learns from data.
```

### What Happens When Multimodal is Enabled
1. **Image Detection**: The plugin scans your markdown for image references
2. **Image Processing**: Found images are converted to base64 format
3. **Model Selection**: 
   - If images are found: Uses vision model (e.g., `llama3.2-vision:11b`)
   - If no images: Uses regular text model (e.g., `llama3.2`)
4. **Enhanced Questions**: Generated flashcards will include questions about both text and visual content

### Sample Generated Questions (with images)
- "What type of neural network architecture is shown in the diagram?"
- "According to the training chart, what happens to the loss over time?"
- "Describe the components visible in the neural network diagram."

## Troubleshooting

### Common Issues

**Images Not Being Processed**
- Check that multimodal support is enabled in settings
- Verify image paths are correct relative to your vault
- Ensure images are in supported formats (png, jpg, etc.)
- Check that images are under the size limit

**Vision Model Not Found (Ollama)**
- Verify the model is installed: `ollama list`
- Pull the model if missing: `ollama pull llama3.2-vision:11b`
- Check that the model name in settings matches exactly

**Large Images Causing Issues**
- Reduce the "Max Image Size" setting
- Compress images before adding to notes
- Use more efficient formats (PNG for diagrams, JPEG for photos)

**Performance Issues**
- Vision models are larger and slower than text-only models
- Consider using smaller vision models (11B vs 90B for Llama 3.2)
- Process fewer images at once by using text selection instead of full files

### Log Information
The plugin logs multimodal processing steps. Check the developer console (Ctrl/Cmd + Shift + I) for:
- Image processing status
- Model selection information
- Error messages

## Tips for Best Results

1. **Image Quality**: Use clear, high-contrast images for better analysis
2. **Alt Text**: Provide descriptive alt text to help the AI understand context
3. **Image Relevance**: Include images that are directly relevant to the learning material
4. **File Organization**: Keep images organized in folders for easier management
5. **Batch Processing**: For large documents with many images, consider processing in smaller sections

## Limitations

- **Local Files Only**: Web URLs (http/https) are not processed for security reasons
- **Size Limits**: Images must be under the configured size limit
- **Format Support**: Only common image formats are supported
- **Processing Time**: Vision models take longer than text-only models
- **Model Availability**: Vision models require more VRAM/RAM than text models

## Backward Compatibility

- **Text-Only Mode**: Disabling multimodal support reverts to original text-only behavior
- **Existing Notes**: Notes without images work exactly as before
- **Settings**: All existing settings are preserved when adding multimodal features