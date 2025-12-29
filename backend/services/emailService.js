const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendVerificationEmail = async (to, token) => {
  const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

  const mailOptions = {
    from: '"ChatBot Platform" <noreply@chatbotplatform.com>', // Sender address
    to: to, // List of receivers
    subject: 'Verifique seu email', // Subject line
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Bem-vindo à Plataforma!</h2>
        <p>Por favor, clique no link abaixo para verificar seu endereço de email:</p>
        <a href="${verificationLink}" style="display: inline-block; padding: 10px 20px; background-color: #128C7E; color: white; text-decoration: none; border-radius: 5px;">Verificar Email</a>
        <p>Ou copie e cole este link no seu navegador:</p>
        <p>${verificationLink}</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    // Don't throw error to prevent blocking registration flow, just log it
    // Or throw if verification is strict requirement
    // For now, let's just log
  }
};

module.exports = {
  sendVerificationEmail,
};
