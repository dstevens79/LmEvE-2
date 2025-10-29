import express from 'express';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));

// Public directory for serving GetMe scripts
const PUBLIC_DIR = join(__dirname, '../public/getme');
if (!existsSync(PUBLIC_DIR)) {
  mkdirSync(PUBLIC_DIR, { recursive: true });
}

// Serve static files from public/getme
app.use('/getme', express.static(PUBLIC_DIR));

/**
 * POST /api/save-getme
 * Saves the GetMe script to the public folder
 * Body: { script: string, filename?: string }
 * Returns: { success: boolean, url: string }
 */
app.post('/api/save-getme', (req, res) => {
  try {
    const { script, filename } = req.body;
    
    if (!script) {
      return res.status(400).json({ 
        success: false, 
        error: 'Script content is required' 
      });
    }

    // Use provided filename or default to 'latest.sh'
    const scriptFilename = filename || 'latest.sh';
    const scriptPath = join(PUBLIC_DIR, scriptFilename);

    // Write the script file
    writeFileSync(scriptPath, script, { mode: 0o755 });

    // Return the public URL
    const url = `/getme/${scriptFilename}`;
    
    console.log(`✅ GetMe script saved: ${scriptPath}`);
    console.log(`📡 Accessible at: ${url}`);

    res.json({ 
      success: true, 
      url,
      filename: scriptFilename
    });

  } catch (error) {
    console.error('❌ Failed to save GetMe script:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
});

/**
 * GET /getme/latest.sh
 * Serves the most recently generated GetMe script
 * (This is handled by the static file middleware above)
 */

app.listen(PORT, () => {
  console.log(`🚀 LMeve API server running on http://localhost:${PORT}`);
  console.log(`📁 GetMe scripts directory: ${PUBLIC_DIR}`);
  console.log(`📡 GetMe scripts accessible at: http://localhost:${PORT}/getme/`);
});

export default app;
