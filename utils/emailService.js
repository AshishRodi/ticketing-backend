const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.elasticemail.com",
  port: 2525,
  secure: false,
  auth: {
    user: "invoiceprocessing639@gmail.com",
    pass: "8A884BF43C62E31462199F7CA6F0EE3B2048"
  }
});

exports.sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: "invoiceprocessing639@gmail.com",
      to,
      subject,
      html
    });
    console.log("Email sent successfully");
  } catch (err) {
    console.error("Email sending error:", err);
  }
};
