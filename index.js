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

    // Load and add Get Mentors logo (smaller, top position)
    try {
      const logo = await loadImageFromUrl('https://res.cloudinary.com/dpglmhglb/image/upload/v1752430102/M-Logo512_e4wycy.png');
      const logoSize = 60;
      ctx.drawImage(logo, 540 - logoSize/2, 530, logoSize, logoSize);

      // Add brand text under logo
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('GET MENTORS', 540, 610);
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
      yPos += (headlineLines.length * getMainLineHeight(platform)) + 40;
      ctx.fillStyle = '#E8E8E8';
      ctx.font = getSupportFont(platform);

      const supportLines = wrapText(ctx, hookContent.support, 900);
      supportLines.forEach((line, index) => {
        ctx.fillText(line, 540, yPos + (index * 36));
      });
      yPos += (supportLines.length * 36) + 30;
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

// Generate more engaging, punchy hook content
function generateEngagingHook(platform, title, content, excerpt) {
  const stats = extractStats(content);
  const problems = extractProblems(content, title);
  const solutions = extractSolutions(title, excerpt);
  const emotions = extractEmotions(content);

  const generators = {
    linkedin: () => ({
      headline: `${stats.primary} OF EXECUTIVES ${problems.main.toUpperCase()}`,
      support: `RESULT: ${problems.consequence.toUpperCase()}\n${solutions.primary.toUpperCase()} CHANGES EVERYTHING`,
      cta: 'LEARN THE SYSTEM ↗'
    }),

    twitter: () => ({
      headline: `HOT TAKE: ${problems.controversial.toUpperCase()}`,
      support: `THEY'RE MISSING ${stats.percentage}% OF POTENTIAL\n${solutions.primary.toUpperCase()} REVEALS THE TRUTH`,
      cta: 'READ THE THREAD ↗'
    }),

    instagram: () => ({
      headline: `POV: YOU'RE THE EXECUTIVE WITH ${solutions.benefit.toUpperCase()}`,
      support: `NO MORE ${problems.struggle.toUpperCase()}\n${solutions.primary.toUpperCase()} = TRANSFORMATION`,
      cta: 'SWIPE FOR MORE ↗'
    }),

    facebook: () => ({
      headline: `"${emotions.relatable.toUpperCase()}?"`,
      support: `WE'VE ALL BEEN THERE - ${emotions.shared.toUpperCase()}\nJUST FOUND THIS GAME-CHANGING SYSTEM`,
      cta: 'SHARE YOUR STORY ↗'
    })
  };

  const generator = generators[platform] || generators.linkedin;
  return generator();
}

// Enhanced content extraction with more engaging outputs
function extractStats(content) {
  const numbers = content.match(/(\d+)%/g) || [];
  const primary = numbers[0] || `${Math.floor(Math.random() * 20) + 80}%`;
  const percentage = primary.replace('%', '');
  return { primary, percentage };
}

function extractProblems(content, title) {
  const problemMap = {
    'mentor': {
      main: 'PICK WRONG MENTORS',
      struggle: 'NAVIGATING MENTORSHIP ALONE',
      controversial: 'MENTORSHIP IS JUST NETWORKING'
    },
    'leadership': {
      main: 'LACK LEADERSHIP SKILLS',
      struggle: 'LEADING WITHOUT DIRECTION',
      controversial: 'LEADERSHIP CAN\'T BE TAUGHT'
    },
    'career': {
      main: 'PLATEAU IN CAREERS',
      struggle: 'CAREER UNCERTAINTY',
      controversial: 'HARD WORK GUARANTEES SUCCESS'
    }
  };

  let problems = {
    main: 'STRUGGLE WITH STRATEGIC GUIDANCE',
    struggle: 'UNCERTAIN NEXT STEPS',
    controversial: 'SUCCESS IS JUST LUCK'
  };

  for (const [keyword, data] of Object.entries(problemMap)) {
    if (title.toLowerCase().includes(keyword) || content.toLowerCase().includes(keyword)) {
      problems = data;
      break;
    }
  }

  return {
    ...problems,
    consequence: 'STALLED CAREERS, WASTED POTENTIAL'
  };
}

function extractSolutions(title, excerpt) {
  const frameworkMatch = title.match(/([\w-]+)\s+(Method|Framework|Matrix|System|Guide)/i);
  const primary = frameworkMatch ? frameworkMatch[0].toUpperCase() : 'STRATEGIC FRAMEWORK';

  const benefitMatch = excerpt.match(/(3x|faster|accelerat|transform|revolutionar|master)/i);
  const benefit = benefitMatch ?
    (benefitMatch[0].includes('3x') ? '3X CAREER ACCELERATION' : 'BREAKTHROUGH RESULTS') :
    'EXCEPTIONAL RESULTS';

  return { primary, benefit };
}

function extractEmotions(content) {
  const emotionMap = {
    'lost': 'FEEL COMPLETELY LOST',
    'stuck': 'FEEL STUCK IN PATTERNS',
    'frustrated': 'GET FRUSTRATED WITH PROGRESS',
    'overwhelmed': 'FEEL OVERWHELMED BY CHOICES'
  };

  let relatable = 'FEEL UNCERTAIN ABOUT NEXT STEPS';
  for (const [trigger, emotion] of Object.entries(emotionMap)) {
    if (content.toLowerCase().includes(trigger)) {
      relatable = emotion;
      break;
    }
  }

  return {
    relatable,
    shared: 'WANTING GUIDANCE BUT NOT KNOWING WHERE TO START'
  };
}

// Improved text wrapping with better word spacing
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine + ' ' + word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
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
