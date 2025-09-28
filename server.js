const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
const PORT = 3000;

// Compte admin
const ADMIN_EMAIL = "adjalamar85@gmail.com";
const ADMIN_PASSWORD = "Karim0549"; // 

// SMTP Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: ADMIN_EMAIL,
    pass: "dlmq dlxx cdlo nwws" // ⚠️ mets ici ton mot de passe d’application Gmail...............
  }
});

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: "secret-key",
  resave: false,
  saveUninitialized: true
}));

app.use("/public", express.static(path.join(__dirname, "public")));

// Page login
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    req.session.user = email;
    res.redirect("/send");
  } else {
    res.redirect("/?error=" + encodeURIComponent("Email ou mot de passe incorrect"));
  }
});

// Page envoi
app.get("/send", (req, res) => {
  if (!req.session.user) return res.redirect("/?error=" + encodeURIComponent("Veuillez vous connecter d'abord"));
  res.sendFile(path.join(__dirname, "views", "send.html"));
});

app.post("/send", async (req, res) => {
  if (!req.session.user) return res.redirect("/?error=" + encodeURIComponent("Veuillez vous connecter d'abord"));

  const { to, subject, message } = req.body;
  const emails = to.split(",").map(e => e.trim()).filter(e => e.length > 0);

  try {
    for (let email of emails) {
      await transporter.sendMail({
        from: ADMIN_EMAIL,
        to: email,
        subject,
        text: message
      });
    }
    res.redirect("/send?success=" + encodeURIComponent("Emails envoyés avec succès ✅"));
  } catch (err) {
    console.error("Send error:", err);
    res.redirect("/send?error=" + encodeURIComponent("Erreur lors de l’envoi ❌"));
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/?success=" + encodeURIComponent("Déconnecté"));
  });
});

app.listen(PORT, () => console.log(`🚀 Serveur en marche: http://localhost:${PORT}`));
