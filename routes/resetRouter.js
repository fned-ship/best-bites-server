const bcrypt = require('bcrypt');
const transporter = require('../mailer.js');
const User = require('../models/user.js');

const resetRouter = (app,clientDomainName, emailUserName) => {

  // Route to send password reset link
  app.post('/resetPassword', async (req, res) => {
    const { email } = req.body;

    try {
      const collection = await User.findOne({ email }, { email: 1, SecurityCode: 1 });

      if (collection) {
        const emailBody = `
          <h1>A link to update password</h1>
          <br>
          <div>Hit the link to continue the process</div>
          <br>
          <a href="${clientDomainName}/newpassword?securitycode=${collection.SecurityCode}&email=${collection.email}">
            ${clientDomainName}/newpassword?securitycode=${collection.SecurityCode}&email=${collection.email}
          </a>
        `;

        const mailOptions = {
          from: emailUserName,
          to: collection.email,
          subject: "Update Password",
          html: emailBody,
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            return res.status(400).json({ res: 'Email Error: ' + error });
          } else {
            return res.status(200).json({ res: 'Link delivered' });
          }
        });
      } else {
        return res.status(200).json({ res: 'Invalid email address' });
      }
    } catch (error) {
      return res.status(500).json({ res: 'Server error' });
    }
  });

  // Route to set new password
  app.post('/newPassword', async (req, res) => {
    const { email, SecurityCode, password } = req.body;
    console.log(email,SecurityCode,password);

    try {
      const collection = await User.findOne({ email, SecurityCode }, { password: 1, SecurityCode: 1 });
      console.log(collection)

      if (collection) {
        bcrypt.genSalt(10, (err, salt) => {
          if (err) return res.status(500).json({ res: 'Error generating salt' });

          bcrypt.hash(password, salt, async (err, hash) => {
            if (err) return res.status(500).json({ res: 'Error hashing password' });

            try {
              const newSecurityCode = String(Date.now()) + String(Math.random());
              collection.SecurityCode = newSecurityCode;
              collection.password = hash;
              await collection.save();
              return res.status(200).json({ res: 'Password updated successfully' });
            } catch (err) {
              return res.status(400).json({ res: 'Error saving new password: ' + err });
            }
          });
        });
      } else {
        return res.status(200).json({ res: 'Invalid user' });
      }
    } catch (error) {
      return res.status(500).json({ res: 'Server error' });
    }
  });

};

module.exports = resetRouter;
