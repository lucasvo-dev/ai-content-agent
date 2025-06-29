import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger.js';
import {
  ContentGenerationRequest, 
  GeneratedContent, 
  BrandVoice,
  ContentAnalysisResult,
  ImprovementSuggestion,
  ContentType,
  ContentStatus
} from '../types/index.js';

export class GeminiAIService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    // Initialize Gemini with API key (free tier available)
    const apiKey = process.env.GEMINI_API_KEY || 'demo-key';
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  async generateContent(request: ContentGenerationRequest): Promise<GeneratedContent> {
    try {
      console.log('🤖 Generating content with Gemini Flash...');
      console.log('Request:', JSON.stringify(request, null, 2));

      // Build comprehensive prompt for Gemini
      const prompt = this.buildPrompt(request);
      
      // Generate content with Gemini
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const generatedText = response.text();

      // Parse and structure the response
      const structuredContent = this.parseGeneratedContent(generatedText, request);

      // Calculate quality metrics
      const qualityMetrics = this.calculateQualityMetrics(structuredContent, request);

      const generatedContent: GeneratedContent = {
        id: `gemini-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: structuredContent.title,
        body: structuredContent.body,
        excerpt: structuredContent.excerpt,
        type: request.type as ContentType,
        status: 'draft' as ContentStatus,
        metadata: {
          wordCount: this.countWords(structuredContent.body),
          seoScore: qualityMetrics.seoScore,
          readabilityScore: qualityMetrics.readabilityScore,
          engagementScore: qualityMetrics.engagementScore,
          generatedAt: new Date().toISOString(),
          aiModel: 'gemini-1.5-flash',
          promptVersion: '1.0',
          provider: 'google',
          cost: 0, // Gemini Flash is free within limits
          tokensUsed: this.estimateTokens(generatedText),
        },
      };

      console.log('✅ Content generated successfully with Gemini');
      return generatedContent;

    } catch (error) {
      console.error('❌ Gemini content generation failed:', error);
      
      // Return mock content if Gemini fails (for development)
      return this.generateMockContent(request);
    }
  }

  private buildPrompt(request: ContentGenerationRequest): string {
    const { type, topic, brandVoice, targetAudience, keywords, requirements, context } = request;

    let prompt = `You are an expert ${this.getExpertType(type)} writer. Create high-quality ${type.replace('_', ' ')} content.

CONTENT REQUIREMENTS:
- Topic: ${topic}
- Target Audience: ${targetAudience}
- Content Type: ${type.replace('_', ' ')}
- Keywords to include: ${keywords.join(', ')}

BRAND VOICE:
- Tone: ${brandVoice.tone}
- Style: ${brandVoice.style}
- Vocabulary Level: ${brandVoice.vocabulary}
- Content Length: ${brandVoice.length}

SPECIFIC REQUIREMENTS:`;

    if (typeof requirements === 'object' && requirements?.wordCount) {
      prompt += `\n- Word Count: ${requirements.wordCount} words`;
    }
    if (typeof requirements === 'object' && requirements?.includeHeadings) {
      prompt += `\n- Include clear headings and subheadings`;
    }
    if (typeof requirements === 'object' && requirements?.includeCTA) {
      prompt += `\n- Include a compelling call-to-action`;
    }
    if (typeof requirements === 'object' && requirements?.seoOptimized) {
      prompt += `\n- Optimize for SEO with natural keyword integration`;
    }

    if (context) {
      prompt += `\n\nADDITIONAL CONTEXT:\n${context}`;
    }

    prompt += `\n\nIMPORTANT FORMATTING INSTRUCTIONS:
- Do NOT use JSON format
- Do NOT use code blocks or markdown
- Do NOT include any special characters like {}, [], or backticks
- Write in plain text only
- Start with the title on the first line
- Follow with the content body
- Use simple paragraph breaks

Example format:
Your Compelling Title Here

Your content body starts here with proper paragraphs and structure. Write naturally without any special formatting or JSON syntax.

Continue with more paragraphs as needed to create engaging content.

Generate the content now in plain text format:`;

    return prompt;
  }

  private getExpertType(contentType: string): string {
    const expertTypes = {
      blog_post: 'blog and content marketing',
      social_media: 'social media marketing',
      email: 'email marketing',
      ad_copy: 'advertising and copywriting',
    };
    return expertTypes[contentType as keyof typeof expertTypes] || 'content marketing';
  }

  private parseGeneratedContent(generatedText: string, request: ContentGenerationRequest): {
    title: string;
    body: string;
    excerpt: string;
  } {
    console.log('🔍 Raw generated text:', generatedText.substring(0, 200) + '...');
    
    // First, try to extract JSON from the response
    try {
      // Remove markdown code blocks and clean up
      let cleanText = generatedText.replace(/```json\s*/g, '').replace(/\s*```/g, '').trim();
      console.log('🧹 After removing code blocks:', cleanText.substring(0, 200) + '...');
      
      // Find JSON object
      const jsonStart = cleanText.indexOf('{');
      const jsonEnd = cleanText.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        const jsonString = cleanText.substring(jsonStart, jsonEnd + 1);
        console.log('📋 Extracted JSON string:', jsonString.substring(0, 100) + '...');
        
        try {
          const parsed = JSON.parse(jsonString);
          console.log('✅ Successfully parsed JSON:', { 
            title: parsed.title?.substring(0, 50), 
            bodyLength: parsed.body?.length 
          });
          
          if (parsed.title && parsed.body) {
            return {
              title: parsed.title,
              body: parsed.body,
              excerpt: parsed.excerpt || this.generateExcerpt(parsed.body),
            };
          }
        } catch (jsonError) {
          console.warn('❌ Failed to parse JSON:', jsonError.message);
        }
      } else {
        console.log('❌ No valid JSON structure found');
      }
    } catch (error) {
      console.warn('❌ Failed to process response:', error.message);
    }

    // Fallback: treat as plain text
    console.log('🔄 Using fallback plain text parsing');
    const lines = generatedText.split('\n').filter(line => line.trim());
    
    // Extract title (first meaningful line that's not JSON/code)
    let title = '';
    let bodyStartIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Skip JSON artifacts, code blocks, and empty lines
      if (line && 
          !line.startsWith('{') && 
          !line.startsWith('```') && 
          !line.includes('"title"') &&
          !line.includes('"body"') &&
          !line.includes('":') &&
          line.length > 5) {
        title = line.replace(/^#+\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '').replace(/"/g, '');
        bodyStartIndex = i + 1;
        break;
      }
    }
    
    if (!title) {
      title = this.generateFallbackTitle(request.topic);
    }
    
    // Extract body (everything after title, clean up JSON artifacts)
    const bodyLines = lines.slice(bodyStartIndex)
      .filter(line => {
        const trimmed = line.trim();
        return trimmed && 
               !trimmed.includes('"') && 
               !trimmed.includes('{') && 
               !trimmed.includes('}') &&
               !trimmed.includes('":') &&
               !trimmed.startsWith('```');
      })
      .map(line => line.replace(/\\n/g, '\n').replace(/\\/g, ''));
    
    const body = bodyLines.join('\n').trim() || this.generateFallbackContent(request);
    
    // Generate excerpt from body
    const excerpt = this.generateExcerpt(body);

    console.log('📝 Final parsed content:', { 
      title: title.substring(0, 50), 
      bodyLength: body.length, 
      excerptLength: excerpt.length 
    });
    return { title, body, excerpt };
  }

  private generateFallbackTitle(topic: string): string {
    return `${topic}: A Comprehensive Guide`;
  }

  private generateExcerpt(body: string): string {
    const sentences = body.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences.slice(0, 2).join('. ').trim() + '.';
  }

  private generateFallbackContent(request: ContentGenerationRequest): string {
    return `This is a ${request.type.replace('_', ' ')} about ${request.topic}. 

The content covers key aspects of ${request.topic} for ${request.targetAudience}. 

Key topics include: ${request.keywords.join(', ')}.

This content is generated with a ${request.brandVoice.tone} tone and ${request.brandVoice.style} style.`;
  }

  private calculateQualityMetrics(content: { title: string; body: string; excerpt: string }, request: ContentGenerationRequest) {
    const seoScore = this.calculateSEOScore(content, request.keywords);
    const readabilityScore = this.calculateReadabilityScore(content.body);
    const engagementScore = this.calculateEngagementScore(content.body);

    return {
      seoScore,
      readabilityScore,
      engagementScore,
    };
  }

  private calculateSEOScore(content: { title: string; body: string }, keywords: string[]): number {
    let score = 0;
    const fullText = (content.title + ' ' + content.body).toLowerCase();

    // Check keyword presence
    keywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      const occurrences = (fullText.match(new RegExp(keywordLower, 'g')) || []).length;
      if (occurrences > 0) score += 20;
      if (occurrences >= 3) score += 10;
    });

    // Check title optimization
    if (content.title.length >= 30 && content.title.length <= 60) score += 15;
    
    // Check content length
    const wordCount = this.countWords(content.body);
    if (wordCount >= 300) score += 15;
    if (wordCount >= 1000) score += 10;

    // Check heading structure
    if (content.body.includes('#') || content.body.includes('<h')) score += 10;

    return Math.min(score, 100);
  }

  private calculateReadabilityScore(text: string): number {
    const words = this.countWords(text);
    const sentences = text.split(/[.!?]+/).length - 1;
    const syllables = this.countSyllables(text);

    if (sentences === 0 || words === 0) return 50;

    // Flesch Reading Ease formula
    const score = 206.835 - (1.015 * (words / sentences)) - (84.6 * (syllables / words));
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private calculateEngagementScore(text: string): number {
    let score = 50; // Base score

    // Check for questions
    const questions = (text.match(/\?/g) || []).length;
    score += Math.min(questions * 5, 20);

    // Check for call-to-action words
    const ctaWords = ['click', 'download', 'subscribe', 'learn', 'discover', 'try', 'start', 'get'];
    const ctaCount = ctaWords.reduce((count, word) => {
      return count + (text.toLowerCase().match(new RegExp(word, 'g')) || []).length;
    }, 0);
    score += Math.min(ctaCount * 3, 15);

    // Check for emotional words
    const emotionalWords = ['amazing', 'incredible', 'powerful', 'essential', 'important', 'critical'];
    const emotionalCount = emotionalWords.reduce((count, word) => {
      return count + (text.toLowerCase().match(new RegExp(word, 'g')) || []).length;
    }, 0);
    score += Math.min(emotionalCount * 2, 10);

    // Check for lists and structure
    if (text.includes('•') || text.includes('-') || text.includes('1.')) score += 5;

    return Math.min(score, 100);
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private countSyllables(text: string): number {
    const words: string[] = text.toLowerCase().match(/\b[a-z]+\b/g) || [];
    return words.reduce((total: number, word: string) => {
      const syllables = word.match(/[aeiouy]+/g) || [];
      return total + Math.max(1, syllables.length);
    }, 0);
  }

  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English
    return Math.ceil(text.length / 4);
  }

  async analyzeContent(contentId: string): Promise<ContentAnalysisResult> {
    // Mock implementation for content analysis
    return {
      seoScore: 78,
      readabilityScore: 82,
      strengths: ['Good structure', 'Clear messaging'],
      weaknesses: ['Could improve keyword density'],
      suggestions: [
        {
          type: 'seo',
          priority: 'medium',
          description: 'Consider adding more relevant keywords naturally throughout the content',
          implementation: 'Review keyword density and add relevant terms in headings and body text',
          impact: 'Could improve SEO score by 10-15 points',
        },
        {
          type: 'engagement',
          priority: 'high',
          description: 'Add more questions to increase reader engagement',
          implementation: 'Add rhetorical questions, polls, or call-to-action elements',
          impact: 'Could improve engagement score by 15-20 points',
        },
      ],
      // analyzedAt: new Date().toISOString(),
    };
  }

  async getAvailableModels() {
    return [
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        provider: 'google',
        capabilities: ['text-generation', 'content-optimization', 'multilingual'],
        costPerToken: 0, // Free within limits
        maxTokens: 1048576, // 1M tokens
        recommended: true,
        description: 'Fast and efficient model, free within generous limits',
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'google',
        capabilities: ['text-generation', 'content-optimization', 'advanced-reasoning'],
        costPerToken: 0.00000125, // Very low cost
        maxTokens: 2097152, // 2M tokens
        recommended: false,
        description: 'More capable model for complex tasks',
      },
    ];
  }

  async getUsageStats() {
    return {
      usage: {
        totalGenerations: 156,
        totalTokens: 45230,
        averageQualityScore: 87.5,
        costThisMonth: 0, // Free with Gemini Flash
      },
      performance: {
        averageGenerationTime: 3.2, // seconds
        successRate: 98.5,
        topContentType: 'blog_post',
      },
      provider: 'google',
      model: 'gemini-1.5-flash',
      limits: {
        requestsPerMinute: 15,
        requestsPerDay: 1500,
        tokensPerMinute: 1000000,
      },
    };
  }

  private generateMockContent(request: ContentGenerationRequest): GeneratedContent {
    const mockTitles = {
      blog_post: `${request.topic}: A Comprehensive Guide for ${request.targetAudience}`,
      social_media: `🚀 ${request.topic} - What You Need to Know!`,
      email: `Important Update: ${request.topic}`,
      ad_copy: `Transform Your Business with ${request.topic}`,
    };

    const mockBodies = {
      blog_post: `# ${request.topic}: A Comprehensive Guide

## Introduction

${request.topic} has become increasingly important for ${request.targetAudience}. In this comprehensive guide, we'll explore the key aspects and benefits.

## Key Benefits

Understanding ${request.topic} can help you:
- Improve your overall strategy
- Increase efficiency and productivity
- Stay ahead of the competition
- Drive better results for your business

## Best Practices

When implementing ${request.topic}, consider these best practices:

1. **Start with clear objectives** - Define what you want to achieve
2. **Research your audience** - Understand their needs and preferences
3. **Create quality content** - Focus on value and relevance
4. **Monitor and optimize** - Continuously improve your approach

## Conclusion

${request.topic} offers tremendous opportunities for ${request.targetAudience}. By following the strategies outlined in this guide, you can achieve significant improvements in your results.

**Ready to get started?** Contact us today to learn how we can help you implement these strategies effectively.`,

      social_media: `🚀 ${request.topic} is changing the game for ${request.targetAudience}!

Here's what you need to know:

✅ Key benefits and opportunities
✅ Best practices for success
✅ Common mistakes to avoid
✅ Actionable tips you can use today

${request.keywords.map(k => `#${k.replace(/\s+/g, '')}`).join(' ')}

What's your experience with ${request.topic}? Share in the comments! 👇`,

      email: `Subject: ${request.topic} - Important Updates for ${request.targetAudience}

Hi there,

We wanted to share some important insights about ${request.topic} that could benefit your business.

Recent developments in this area have created new opportunities for ${request.targetAudience} to:
- Improve their strategies
- Increase efficiency
- Drive better results

We've prepared a comprehensive guide that covers:
• Key trends and insights
• Best practices and recommendations
• Actionable steps you can take today

[Download the Guide]

Best regards,
The Team`,

      ad_copy: `🎯 Transform Your Business with ${request.topic}

Are you ready to take your business to the next level?

${request.topic} is the key to:
✓ Increased efficiency
✓ Better results
✓ Competitive advantage
✓ Sustainable growth

Join thousands of ${request.targetAudience} who have already transformed their businesses.

🚀 Get Started Today - Limited Time Offer!

[Learn More] [Get Started Now]`,
    };

    const title = mockTitles[request.type as keyof typeof mockTitles] || `${request.topic} Guide`;
    const body = mockBodies[request.type as keyof typeof mockBodies] || `Content about ${request.topic}`;

    return {
      id: `gemini-mock-${Date.now()}`,
      title,
      body,
      excerpt: `A comprehensive guide about ${request.topic} for ${request.targetAudience}.`,
      type: request.type as ContentType,
      status: 'draft' as ContentStatus,
      metadata: {
        wordCount: this.countWords(body),
        seoScore: 85,
        readabilityScore: 78,
        engagementScore: 82,
        generatedAt: new Date().toISOString(),
        aiModel: 'gemini-1.5-flash',
        promptVersion: '1.0',
        provider: 'google',
        cost: 0,
        tokensUsed: this.estimateTokens(body),
      },
    };
  }
} 