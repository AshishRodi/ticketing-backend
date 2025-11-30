require("dotenv").config();
const { sendEmail } = require("./utils/emailService");

sendEmail("invoiceprocessing639@gmail.com", "Test", "<h1>Hello From Brevo</h1>")
  .then(() => console.log("Done"))
  .catch(err => console.error(err));
