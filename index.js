// index.js - Canvas overlay service for Railway
const express = require('express');
const { createCanvas, loadImage, registerFont } = require('canvas');
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
    console.log('Overlay request received:', {
      background_url: req.body.background_url?.substring(0, 50) + '...',
      platform: req.body.platform,
      content_length: req.body.content?.length
    });

    const { background_url, content, platform, title, excerpt } = req.body;

    if (!background_url || !content) {
      return res.status(400).json({ error: 'Missing background_url or content' });
    }

    // Create 1080x1080 canvas
    const canvas = createCanvas(1080, 1080);
    const ctx = canvas.getContext('2d');

    // Load background image
    console.log('Loading background image...');
    const background = await loadImageFromUrl(background_url);
    ctx.drawImage(background, 0, 0, 1080, 1080);

    // Add gradient overlay for text readability
    const gradient = ctx.createLinearGradient(0, 600, 0, 1080);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 600, 1080, 480);

    // Load and add Get Mentors logo
    console.log('Loading logo...');
    try {
      const logo = await loadImageFromUrl('https://res.cloudinary.com/dpglmhglb/image/upload/v1752430102/M-Logo512_e4wycy.png');
      const logoSize = 80;
      ctx.drawImage(logo, 540 - logoSize/2, 630, logoSize, logoSize);
    } catch (logoError) {
      console.warn('Logo failed to load:', logoError.message);
    }

    // Add "GET MENTORS" text under logo
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GET MENTORS', 540, 730);

    // Generate platform-specific hook text
    const hookText = generatePlatformHook(platform, title, content, excerpt);

    // Main hook text - platform optimized font
    ctx.fillStyle = '#FFFFFF';
    ctx.font = getPlatformFont(platform);
    ctx.textAlign = 'center';

    const mainLines = wrapText(ctx, hookText.main, 900);
    let yPosition = 780;

    mainLines.forEach((line, index) => {
      ctx.fillText(line, 540, yPosition + (index * getPlatformLineHeight(platform)));
    });

    // Supporting text
    if (hookText.support) {
      ctx.font = getPlatformSupportFont(platform);
      ctx.fillStyle = '#E8E8E8';
      yPosition += (mainLines.length * getPlatformLineHeight(platform)) + 30;

      const supportLines = wrapText(ctx, hookText.support, 900);
      supportLines.forEach((line, index) => {
        ctx.fillText(line, 540, yPosition + (index * 32));
      });
    }

    // Call to action with brand gradient
    const brandGradient = ctx.createLinearGradient(440, 0, 640, 0);
    brandGradient.addColorStop(0, '#FF1F71');
    brandGradient.addColorStop(1, '#9C19CD');

    ctx.fillStyle = brandGradient;
    ctx.font = 'bold 22px Arial';
    ctx.fillText('Read More ↗', 540, 1020);

    // Convert to buffer
    const buffer = canvas.toBuffer('image/png');
    console.log('Canvas overlay completed, buffer size:', buffer.length);

    // Return base64 image
    res.json({
      success: true,
      image_base64: buffer.toString('base64'),
      image_url: `data:image/png;base64,${buffer.toString('base64')}`,
      platform: platform,
      hook_used: hookText
    });

  } catch (error) {
    console.error('Overlay error:', error);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Platform-specific font settings
function getPlatformFont(platform) {
  const fonts = {
    linkedin: 'bold 40px Arial',
    twitter: 'bold 38px Arial',
    instagram: 'bold 42px Arial',
    facebook: 'bold 36px Arial'
  };
  return fonts[platform] || fonts.linkedin;
}

function getPlatformLineHeight(platform) {
  const heights = {
    linkedin: 48,
    twitter: 45,
    instagram: 50,
    facebook: 43
  };
  return heights[platform] || 48;
}

function getPlatformSupportFont(platform) {
  const fonts = {
    linkedin: 'normal 26px Arial',
    twitter: 'normal 24px Arial',
    instagram: 'normal 28px Arial',
    facebook: 'normal 25px Arial'
  };
  return fonts[platform] || fonts.linkedin;
}

// Generate platform-specific hooks
function generatePlatformHook(platform, title, content, excerpt) {
  const stats = extractStats(content);
  const problems = extractProblems(content, title);
  const solutions = extractSolutions(title, excerpt);

  const generators = {
    linkedin: () => ({
      main: `${stats.primary} of executives ${problems.main} 🎯`,
      support: `Result: ${problems.consequence}\n${solutions.primary} changes everything ⚡`
    }),
    twitter: () => ({
      main: `Hot take: Most executives ${problems.mistake}`,
      support: `They're missing ${stats.percentage}% of potential\n${solutions.primary} reveals the truth 🎯`
    }),
    instagram: () => ({
      main: `POV: You're the executive with ${solutions.benefit} ✨`,
      support: `No more ${problems.struggle}\n${solutions.primary} = transformation 🚀`
    }),
    facebook: () => ({
      main: `Anyone else feel ${problems.relatable}? 😅`,
      support: `We've all been there - ${problems.shared}\nJust found this game-changing system 🤔`
    })
  };

  const generator = generators[platform] || generators.linkedin;
  return generator();
}

// Content extraction functions
function extractStats(content) {
  const numbers = content.match(/(\d+)%/g) || [];
  const primary = numbers[0] || `${Math.floor(Math.random() * 20) + 80}%`;
  const percentage = primary.replace('%', '');
  return { primary, percentage };
}

function extractProblems(content, title) {
  const problemKeywords = {
    'mentor': { main: 'struggle finding the right mentors', struggle: 'navigating mentorship alone' },
    'leadership': { main: 'lack strategic leadership skills', struggle: 'leading without direction' },
    'innovation': { main: 'fail at innovation execution', struggle: 'stuck in old patterns' },
    'career': { main: 'plateau in their careers', struggle: 'career uncertainty' }
  };

  let problemData = { main: 'struggle with strategic guidance', struggle: 'uncertain about next steps' };
  for (const [keyword, data] of Object.entries(problemKeywords)) {
    if (title.toLowerCase().includes(keyword) || content.toLowerCase().includes(keyword)) {
      problemData = data;
      break;
    }
  }

  return {
    ...problemData,
    consequence: 'Stalled careers, wasted potential',
    mistake: 'think mentorship = finding someone older',
    relatable: 'totally lost trying to find the right mentor',
    shared: 'wanting guidance but no clue where to start'
  };
}

function extractSolutions(title, excerpt) {
  const frameworkMatch = title.match(/([\w-]+)\s+(Method|Framework|Matrix|System|Guide)/i);
  const primary = frameworkMatch ? frameworkMatch[0] : 'Strategic Framework';

  const benefitMatch = excerpt.match(/(3x|faster|accelerat|transform|revolutionar|master)/i);
  const benefit = benefitMatch ?
    (benefitMatch[0].includes('3x') ? '3x career acceleration' : 'breakthrough results') :
    'exceptional results';

  return { primary, benefit };
}

// Utility functions
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

async function loadImageFromUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load image: ${response.status} ${response.statusText}`);
  }
  const buffer = await response.buffer();
  return await loadImage(buffer);
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Overlay service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});
