import sharp from 'sharp';
import { logger } from '../utils/logger';

export interface ImageProcessingOptions {
  maxSizeKB?: number; // Default 600KB
  quality?: number; // Default 85
  format?: 'jpeg' | 'webp' | 'png';
  maxWidth?: number; // Default 1920
  maxHeight?: number; // Default 1080
}

export interface ImageMetadata {
  width: number;
  height: number;
  aspectRatio: number;
  isLandscape: boolean;
  format: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export class ImageProcessingService {
  private readonly defaultOptions: Required<ImageProcessingOptions> = {
    maxSizeKB: 600, // Target 600KB (500-700KB range)
    quality: 85,
    format: 'jpeg',
    maxWidth: 1920,
    maxHeight: 1080
  };

  /**
   * Compress image to target size while maintaining quality
   */
  async compressImage(
    imageBuffer: Buffer,
    options: ImageProcessingOptions = {}
  ): Promise<{ buffer: Buffer; metadata: ImageMetadata }> {
    try {
      const opts = { ...this.defaultOptions, ...options };
      const originalSize = imageBuffer.length;
      
      logger.info(`🔧 Compressing image: ${(originalSize / 1024).toFixed(2)}KB → target: ${opts.maxSizeKB}KB`);

      // Get original image metadata
      const imageInfo = await sharp(imageBuffer).metadata();
      const originalWidth = imageInfo.width || 0;
      const originalHeight = imageInfo.height || 0;
      const aspectRatio = originalWidth > 0 && originalHeight > 0 ? originalWidth / originalHeight : 1;
      
      logger.info(`📐 Original dimensions: ${originalWidth}x${originalHeight} (aspect ratio: ${aspectRatio.toFixed(2)})`);

      let sharpInstance = sharp(imageBuffer);
      
      // Resize if image is too large
      if (originalWidth > opts.maxWidth || originalHeight > opts.maxHeight) {
        sharpInstance = sharpInstance.resize(opts.maxWidth, opts.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
        logger.info(`📏 Resizing to max ${opts.maxWidth}x${opts.maxHeight}`);
      }

      // Convert to target format and compress
      let compressedBuffer: Buffer;
      let quality = opts.quality;
      const targetSizeBytes = opts.maxSizeKB * 1024;

      // Try compression with different quality levels
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          if (opts.format === 'jpeg') {
            compressedBuffer = await sharpInstance
              .jpeg({ 
                quality, 
                progressive: true,
                mozjpeg: true // Better compression
              })
              .toBuffer();
          } else if (opts.format === 'webp') {
            compressedBuffer = await sharpInstance
              .webp({ 
                quality,
                effort: 6 // High compression effort
              })
              .toBuffer();
          } else {
            compressedBuffer = await sharpInstance
              .png({ 
                compressionLevel: 9,
                quality
              })
              .toBuffer();
          }

          const compressedSize = compressedBuffer.length;
          
          // Check if we hit our target size
          if (compressedSize <= targetSizeBytes) {
            logger.info(`✅ Compression successful: ${(compressedSize / 1024).toFixed(2)}KB (quality: ${quality})`);
            break;
          }
          
          // If too large, reduce quality and try again
          if (attempt < 4) {
            quality = Math.max(30, quality - 15); // Reduce quality but not below 30
            logger.info(`📉 File too large (${(compressedSize / 1024).toFixed(2)}KB), reducing quality to ${quality}`);
          } else {
            logger.warn(`⚠️ Final compression: ${(compressedSize / 1024).toFixed(2)}KB (above target but acceptable)`);
          }
        } catch (error) {
          logger.error(`❌ Compression attempt ${attempt + 1} failed:`, error);
          if (attempt === 4) throw error;
          quality = Math.max(30, quality - 20);
        }
      }

      // Get final metadata
      const finalInfo = await sharp(compressedBuffer!).metadata();
      const finalWidth = finalInfo.width || originalWidth;
      const finalHeight = finalInfo.height || originalHeight;
      const finalAspectRatio = finalWidth > 0 && finalHeight > 0 ? finalWidth / finalHeight : aspectRatio;

      const metadata: ImageMetadata = {
        width: finalWidth,
        height: finalHeight,
        aspectRatio: finalAspectRatio,
        isLandscape: finalAspectRatio > 1.0,
        format: opts.format,
        originalSize,
        compressedSize: compressedBuffer!.length,
        compressionRatio: (originalSize - compressedBuffer!.length) / originalSize
      };

      logger.info(`📊 Compression results:`, {
        originalSize: `${(originalSize / 1024).toFixed(2)}KB`,
        compressedSize: `${(metadata.compressedSize / 1024).toFixed(2)}KB`,
        compressionRatio: `${(metadata.compressionRatio * 100).toFixed(1)}%`,
        dimensions: `${finalWidth}x${finalHeight}`,
        aspectRatio: finalAspectRatio.toFixed(2),
        isLandscape: metadata.isLandscape
      });

      return {
        buffer: compressedBuffer!,
        metadata
      };

    } catch (error) {
      logger.error('❌ Image compression failed:', error);
      throw new Error(`Image compression failed: ${error.message}`);
    }
  }

  /**
   * Detect if image is landscape based on actual dimensions
   */
  async detectLandscape(imageBuffer: Buffer): Promise<{
    isLandscape: boolean;
    aspectRatio: number;
    width: number;
    height: number;
  }> {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      const width = metadata.width || 0;
      const height = metadata.height || 0;
      const aspectRatio = width > 0 && height > 0 ? width / height : 1;
      const isLandscape = aspectRatio > 1.0;

      return {
        isLandscape,
        aspectRatio,
        width,
        height
      };
    } catch (error) {
      logger.error('❌ Failed to detect image orientation:', error);
      return {
        isLandscape: false,
        aspectRatio: 1,
        width: 0,
        height: 0
      };
    }
  }

  /**
   * Optimize image specifically for WordPress uploads
   */
  async optimizeForWordPress(imageBuffer: Buffer): Promise<{
    buffer: Buffer;
    metadata: ImageMetadata;
    filename: string;
  }> {
    const result = await this.compressImage(imageBuffer, {
      maxSizeKB: 650, // Slightly higher for WordPress
      quality: 88,
      format: 'jpeg',
      maxWidth: 1920,
      maxHeight: 1080
    });

    // Generate optimized filename
    const timestamp = Date.now();
    const orientation = result.metadata.isLandscape ? 'landscape' : 'portrait';
    const filename = `wp-optimized-${orientation}-${timestamp}.jpg`;

    return {
      ...result,
      filename
    };
  }

  /**
   * Batch process multiple images
   */
  async batchProcess(
    images: { buffer: Buffer; originalName: string }[],
    options: ImageProcessingOptions = {}
  ): Promise<Array<{
    buffer: Buffer;
    metadata: ImageMetadata;
    originalName: string;
    optimizedName: string;
  }>> {
    logger.info(`🔄 Batch processing ${images.length} images...`);
    
    const results = [];
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      try {
        logger.info(`📸 Processing image ${i + 1}/${images.length}: ${image.originalName}`);
        
        const result = await this.compressImage(image.buffer, options);
        const orientation = result.metadata.isLandscape ? 'landscape' : 'portrait';
        const optimizedName = `optimized-${orientation}-${i + 1}-${Date.now()}.jpg`;

        results.push({
          ...result,
          originalName: image.originalName,
          optimizedName
        });
        
      } catch (error) {
        logger.error(`❌ Failed to process ${image.originalName}:`, error);
        // Skip failed images but continue processing others
      }
    }

    logger.info(`✅ Batch processing complete: ${results.length}/${images.length} images processed`);
    return results;
  }
} 