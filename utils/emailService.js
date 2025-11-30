const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

exports.sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: to,
      subject,
      html,
    });
    console.log("Email sent successfully via Brevo!");
  } catch (err) {
    console.error("Email sending error:", err);
  }
};
