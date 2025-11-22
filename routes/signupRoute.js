const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcrypt');
const User = require('../models/user.js');
const transporter = require('../mailer.js'); // Importing the transporter


// Configure Multer for local file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../public/imagesProfile');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const fileName = `${Date.now()}_${Math.random()}_${file.originalname}`;
    cb(null, fileName);
  },
});

const upload = multer({ storage });

// Signup route
const signupRoute = (app,clientDomainName, emailUserName) => {
  app.post('/signup', upload.single('image'), async (req, res) => {
    let data;
    try {
        data = JSON.parse(req.body.data);
    } catch (err) {
        return res.status(400).json({ res: 'Invalid JSON in data' });
    }
    const file = req.file;
    let imagePath;

    try {
      if (file) {
        imagePath = file.filename; // Store filename only
      }

      const existingUser = await User.findOne({ email: data.email });
      if (existingUser) {
        if (file) {
          const fullPath = path.join(__dirname, '../public/imagesProfile', imagePath);
          if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        }
        return res.status(200).json('exist');
      }

      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(data.password, salt);
      const SecurityCode = String(Date.now()) + String(Math.random());
      const id = SecurityCode;

      const newUser = new User({
        firstName: data.firstName,
        lastName: data.lastName,
        password: hash,
        email: data.email,
        birthDay: data.birthDay,
        imageSrc: imagePath,
        SecurityCode,
        isActive: false,
        number: data.number,
        address: data.address,
        role: data.role,
        id,
      });

      const emailBody = `
        <h1>Thank you for signing up!</h1>
        <div>Hit the link to continue the process:</div>
        <a href="${clientDomainName}/active/${SecurityCode}">${clientDomainName}/active/${SecurityCode}</a>
      `;

      const mailOptions = {
        from: emailUserName,
        to: data.email,
        subject: 'Security Code',
        html: emailBody,
      };

      try {
        await transporter.sendMail(mailOptions);
        await newUser.save();
        return res.status(200).json('added');
      } catch (error) {
        if (file) {
          const fullPath = path.join(__dirname, '../public/imagesProfile', imagePath);
          if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        }
        return res.status(400).json('Email Error: ' + error);
      }
    } catch (error) {
      if (file && imagePath) {
        const fullPath = path.join(__dirname, '../public/imagesProfile', imagePath);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      }
      return res.status(500).json('Server Error: ' + error);
    }
  });

};

module.exports = signupRoute;
