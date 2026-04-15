cd ~/horizon/horizon-travel-agency-platform

cat > server/routes/upload.js << 'EOF'
const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const authenticate = require('../middleware/authenticate');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.dx6sjqilm,
  api_key: process.env.558797687794172,
  api_secret: process.env.HJ_R-dZJQmJbaGKj1OUQvgsHJNw
});

// Configure multer (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Upload endpoint (protected)
router.post('/', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Convert buffer to base64 data URI
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: `agency_${req.agency.id}`,
      resource_type: 'auto'
    });

    res.json({
      url: result.secure_url,
      public_id: result.public_id
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
EOF

echo "✅ upload.js created"
