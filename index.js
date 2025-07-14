// index.js - Enhanced Canvas overlay service for Railway
const express = require('express');
const { createCanvas, loadImage } = require('canvas');
const fetch = require('node-fetch');
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    canvas: 'available'
  });
});

// Main overlay endpoint
app.post('/overlay', async (req, res) => {
  try {
    const { background_url, content, platform, title, excerpt } = req.body;

    console.log('=== OVERLAY REQUEST ===');
    console.log('Platform:', platform);
    console.log('Content length:', content?.length);
    console.log('Title:', title?.substring(0, 50) + '...');

    if (!background_url || !content) {
      return res.status(400).json({ error: 'Missing background_url or content' });
    }

    // Create 1080x1080 canvas
    const canvas = createCanvas(1080, 1080);
    const ctx = canvas.getContext('2d');

    // Load and draw background image
    const background = await loadImageFromUrl(background_url);
    ctx.drawImage(background, 0, 0, 1080, 1080);

    // Create stronger overlay for better text readability
    const overlay = ctx.createLinearGradient(0, 500, 0, 1080);
    overlay.addColorStop(0, 'rgba(0, 0, 0, 0.2)');
    overlay.addColorStop(0.6, 'rgba(0, 0, 0, 0.8)');
    overlay.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 500, 1080, 580);

    // Load and add Get Mentors logo
    try {
      const logo = await loadImageFromUrl('https://res.cloudinary.com/dpglmhglb/image/upload/v1752430102/M-Logo512_e4wycy.png');
      const logoSize = 100;
      ctx.drawImage(logo, 540 - logoSize/2, 530, logoSize, logoSize);
    } catch (logoError) {
      console.warn('Logo failed to load:', logoError.message);
    }

    // Generate platform-specific hook content
    const hookContent = generateEngagingHook(platform, title, content, excerpt);

    // Set up text styling
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Main headline - large and bold
    ctx.fillStyle = getMainTextColor(platform);
    ctx.font = getMainFont(platform);

    const headlineLines = wrapText(ctx, hookContent.headline, 950);
    let yPos = 720;

    headlineLines.forEach((line, index) => {
      ctx.fillText(line, 540, yPos + (index * getMainLineHeight(platform)));
    });

    // Supporting text - smaller, white
    if (hookContent.support) {
      yPos += (headlineLines.length * getMainLineHeight(platform)) + 50; // More spacing
      ctx.fillStyle = '#E8E8E8';
      ctx.font = getSupportFont(platform);

      const supportLines = wrapText(ctx, hookContent.support, 900);
      supportLines.forEach((line, index) => {
        ctx.fillText(line, 540, yPos + (index * 40)); // Increased line height
      });
      yPos += (supportLines.length * 40) + 40; // More spacing after
    }

    // Call to action with gradient
    const ctaGradient = ctx.createLinearGradient(300, 0, 780, 0);
    ctaGradient.addColorStop(0, '#FF1F71');
    ctaGradient.addColorStop(1, '#9C19CD');

    ctx.fillStyle = ctaGradient;
    ctx.font = 'bold 24px Arial';
    ctx.fillText(hookContent.cta, 540, Math.min(yPos + 40, 1020));

    // Convert to buffer
    const buffer = canvas.toBuffer('image/png');
    console.log('Canvas overlay completed, buffer size:', buffer.length);

    // Return response
    res.json({
      success: true,
      image_base64: buffer.toString('base64'),
      image_url: `data:image/png;base64,${buffer.toString('base64')}`,
      platform: platform,
      hook_used: hookContent
    });

  } catch (error) {
    console.error('Overlay error:', error);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Enhanced font settings for more engaging text
function getMainFont(platform) {
  const fonts = {
    linkedin: 'bold 52px Arial',
    twitter: 'bold 48px Arial',
    instagram: 'bold 56px Arial',
    facebook: 'bold 50px Arial'
  };
  return fonts[platform] || fonts.linkedin;
}

function getMainLineHeight(platform) {
  const heights = {
    linkedin: 58,
    twitter: 54,
    instagram: 62,
    facebook: 56
  };
  return heights[platform] || 58;
}

function getSupportFont(platform) {
  const fonts = {
    linkedin: 'normal 28px Arial',
    twitter: 'normal 26px Arial',
    instagram: 'normal 30px Arial',
    facebook: 'normal 27px Arial'
  };
  return fonts[platform] || fonts.linkedin;
}

function getMainTextColor(platform) {
  const colors = {
    linkedin: '#FFFFFF',
    twitter: '#FFD700',  // Gold for Twitter
    instagram: '#FF69B4', // Hot pink for Instagram
    facebook: '#87CEEB'   // Sky blue for Facebook
  };
  return colors[platform] || '#FFFFFF';
}

// Smart content-first hook generation
function generateEngagingHook(platform, title, content, excerpt) {
  // Extract the best parts from your actual content
  const contentLines = content.split('\n').filter(line => line.trim().length > 10);
  const stats = extractDynamicStats(content);
  const hooks = extractContentHooks(contentLines);

  const generators = {
    linkedin: () => {
      // Use first strong statement from content, with stats if available
      const headline = hooks.statistic || hooks.strong || extractFirstSentence(content);
      const support = hooks.result || hooks.framework || extractKeyBenefit(excerpt);

      return {
        headline: formatForDisplay(headline),
        support: formatForDisplay(support),
        cta: 'LINK IN BIO ↗'
      };
    },

    twitter: () => {
      // Look for controversial/hot take statements
      const headline = hooks.hotTake || hooks.controversial || hooks.strong || extractFirstSentence(content);
      const support = hooks.statistic || hooks.revelation || extractKeyBenefit(excerpt);

      return {
        headline: formatForDisplay(headline),
        support: formatForDisplay(support),
        cta: 'LINK IN BIO ↗'
      };
    },

    instagram: () => {
      // Look for POV or transformation statements
      const headline = hooks.pov || hooks.transformation || hooks.aspirational || extractFirstSentence(content);
      const support = hooks.benefit || hooks.transformation || extractKeyBenefit(excerpt);

      return {
        headline: formatForDisplay(headline),
        support: formatForDisplay(support),
        cta: 'LINK IN BIO ↗'
      };
    },

    facebook: () => {
      // Look for questions or relatable statements
      const headline = hooks.question || hooks.relatable || hooks.story || extractFirstSentence(content);
      const support = hooks.story || hooks.solution || extractKeyBenefit(excerpt);

      return {
        headline: formatForDisplay(headline),
        support: formatForDisplay(support),
        cta: 'LINK IN BIO ↗'
      };
    }
  };

  const generator = generators[platform] || generators.linkedin;
  return generator();
}

// Extract different types of hooks from your actual content
function extractContentHooks(contentLines) {
  const hooks = {};

  contentLines.forEach(line => {
    const cleanLine = line.trim();

    // Statistics (numbers with %)
    if (/\d+%/.test(cleanLine) && !hooks.statistic) {
      hooks.statistic = cleanLine;
    }

    // Questions
    if (cleanLine.includes('?') && !hooks.question) {
      hooks.question = cleanLine;
    }

    // POV statements
    if (cleanLine.toLowerCase().includes('pov:') && !hooks.pov) {
      hooks.pov = cleanLine;
    }

    // Hot takes
    if (cleanLine.toLowerCase().includes('hot take') && !hooks.hotTake) {
      hooks.hotTake = cleanLine;
    }

    // Result statements
    if (cleanLine.toLowerCase().includes('result:') && !hooks.result) {
      hooks.result = cleanLine;
    }

    // Strong declarative statements (short, punchy)
    if (cleanLine.length < 80 && cleanLine.length > 20 && !cleanLine.includes('?') && !hooks.strong) {
      hooks.strong = cleanLine;
    }

    // Transformation/benefit statements
    if ((cleanLine.includes('transform') || cleanLine.includes('changes') || cleanLine.includes('=')) && !hooks.transformation) {
      hooks.transformation = cleanLine;
    }

    // Relatable statements (emotional)
    if ((cleanLine.includes('feel') || cleanLine.includes('been there') || cleanLine.includes('we\'ve all')) && !hooks.relatable) {
      hooks.relatable = cleanLine;
    }

    // Framework mentions
    if ((cleanLine.includes('Matrix') || cleanLine.includes('System') || cleanLine.includes('Framework')) && !hooks.framework) {
      hooks.framework = cleanLine;
    }
  });

  return hooks;
}

// Extract key benefit from excerpt
function extractKeyBenefit(excerpt) {
  if (!excerpt) return "STRATEGIC INSIGHTS FOR PROFESSIONALS";

  // Look for benefit keywords
  const benefitKeywords = ['3x', 'faster', 'accelerat', 'transform', 'revolutionar', 'master', 'breakthrough'];
  const sentences = excerpt.split('.').filter(s => s.trim().length > 10);

  for (const sentence of sentences) {
    for (const keyword of benefitKeywords) {
      if (sentence.toLowerCase().includes(keyword)) {
        return sentence.trim();
      }
    }
  }

  return sentences[0] || excerpt.substring(0, 100);
}

// Get first strong sentence from content
function extractFirstSentence(content) {
  const sentences = content.split(/[.!?]/).filter(s => s.trim().length > 15);
  return sentences[0]?.trim() || content.substring(0, 80);
}

// Smart formatting for display
function formatForDisplay(text) {
  if (!text) return "PROFESSIONAL INSIGHTS";

  // Clean up the text
  let formatted = text
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove emojis for headline (we'll add them back strategically)
  formatted = formatted.replace(/[^\w\s.,!?:%-]/g, '');

  // Convert to uppercase for impact, but preserve some structure
  if (formatted.length < 60) {
    return formatted.toUpperCase();
  } else {
    // For longer text, keep sentence case but make key words uppercase
    return formatted.replace(/\b(RESULT|POV|HOT TAKE|MATRIX|SYSTEM|FRAMEWORK|TRANSFORMATION)\b/gi, word => word.toUpperCase());
  }
}

// Dynamic stats extraction
function extractDynamicStats(content) {
  const numbers = content.match(/(\d+)%/g) || [];
  const primary = numbers[0] || null;
  const secondary = numbers[1] || null;

  return {
    primary,
    secondary,
    hasStats: numbers.length > 0
  };
}

// Improved text wrapping with better word spacing
// Enhanced text wrapping that respects sentence boundaries
function wrapText(ctx, text, maxWidth) {
  // First try to wrap by sentences
  const sentences = text.split(/(?<=[.!?])\s+/);
  const lines = [];
  let currentLine = '';

  for (const sentence of sentences) {
    const testLine = currentLine ? currentLine + ' ' + sentence : sentence;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = sentence;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  // If any line is still too long, fall back to word wrapping
  const finalLines = [];
  for (const line of lines) {
    if (ctx.measureText(line).width <= maxWidth) {
      finalLines.push(line);
    } else {
      // Word wrap this line
      const words = line.split(' ');
      let wordLine = words[0] || '';

      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const testLine = wordLine + ' ' + word;

        if (ctx.measureText(testLine).width > maxWidth && wordLine.length > 0) {
          finalLines.push(wordLine);
          wordLine = word;
        } else {
          wordLine = testLine;
        }
      }

      if (wordLine.length > 0) {
        finalLines.push(wordLine);
      }
    }
  }

  return finalLines;
}

// Optimized image loading with error handling
async function loadImageFromUrl(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to load image: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.buffer();
    return await loadImage(buffer);
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Enhanced overlay service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});
